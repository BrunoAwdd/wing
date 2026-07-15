import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// Regra arquitetural: domain/ e application/ de cada bounded context nunca
// podem importar infraestrutura (própria ou de outro contexto), serviços
// legados (backend/src/services/**) ou ler Deno.env diretamente — essas
// dependências pertencem ao composition root (rotas) e aos adaptadores em
// infrastructure/. Sem essa checagem automatizada, a violação corrigida no
// ChatUseCases (M4.8) podia voltar a acontecer silenciosamente.
//
// Além disso: nenhum contexto pode importar application/ ou infrastructure/
// de OUTRO contexto diretamente (comunicação entre contextos deve passar
// por portas), e domain/ nunca pode importar de application/ do mesmo
// contexto (a direção de dependência é sempre domain <- application).
// domain -> domain entre contextos é permitido como shared kernel (ex:
// chat/application usa cache/domain/ChatHistoryCompactor).
const CONTEXTS_DIR = new URL("./", import.meta.url).pathname;

const collectTsFiles = async (dir: string): Promise<string[]> => {
  const files: string[] = [];
  for await (const entry of Deno.readDir(dir)) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory) {
      files.push(...await collectTsFiles(path));
    } else if (entry.isFile && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      files.push(path);
    }
  }
  return files;
};

const isGuardedLayer = (path: string): boolean =>
  /\/(domain|application)\//.test(path);

interface ContextLocation {
  context: string;
  layer: string;
}

export const locateInContexts = (path: string): ContextLocation | null => {
  const match = path.match(/\/contexts\/([^/]+)\/([^/]+)\//);
  return match ? { context: match[1], layer: match[2] } : null;
};

// Resolve um specifier relativo ("../../foo.ts") a partir do arquivo que o
// importa, usando resolução de URL padrão (trata o caminho do importador
// como base, igual à resolução real de módulos ES).
export const resolveRelativeSpecifier = (importerPath: string, specifier: string): string =>
  new URL(specifier, `file://${importerPath}`).pathname;

export const extractImportSpecifiers = (content: string): string[] => {
  const importLines = content.match(/^import[^\n]*from\s+["'][^"']+["']/gm) ?? [];
  return importLines
    .map((line) => line.match(/from\s+["']([^"']+)["']/)?.[1])
    .filter((specifier): specifier is string => Boolean(specifier));
};

export const analyzeFile = (path: string, content: string): string[] => {
  const violations: string[] = [];
  const own = locateInContexts(path);
  if (!own) return violations;

  if (/\bDeno\.env\b/.test(content)) {
    violations.push("usa Deno.env diretamente");
  }

  for (const specifier of extractImportSpecifiers(content)) {
    if (specifier.includes("/infrastructure/")) {
      violations.push(`importa infraestrutura: ${specifier}`);
      continue;
    }
    if (/(^|\/)services\//.test(specifier)) {
      violations.push(`importa serviço legado: ${specifier}`);
      continue;
    }
    if (!specifier.startsWith(".")) continue; // pacote externo (deps.ts, std@, etc.)

    const target = locateInContexts(resolveRelativeSpecifier(path, specifier));
    if (!target) continue;

    if (target.context !== own.context && target.layer !== "domain") {
      violations.push(
        `depende diretamente do contexto '${target.context}' (camada '${target.layer}'): ${specifier} — comunicação entre contextos deve passar por portas`,
      );
      continue;
    }

    if (own.layer === "domain" && target.layer === "application") {
      violations.push(`domain importa application (direção invertida): ${specifier}`);
    }
  }

  return violations;
};

Deno.test("architecture guard: domain/application dos bounded contexts não dependem de ENV, infra, serviços legados ou de outro contexto diretamente", async () => {
  const allFiles = await collectTsFiles(CONTEXTS_DIR.replace(/\/$/, ""));
  const guardedFiles = allFiles.filter(isGuardedLayer);

  const report: string[] = [];
  for (const file of guardedFiles) {
    const content = await Deno.readTextFile(file);
    for (const violation of analyzeFile(file, content)) {
      report.push(`${file}: ${violation}`);
    }
  }

  assertEquals(report, [], `Violações arquiteturais encontradas:\n${report.join("\n")}`);
});

// Testes da própria lógica do guard, com conteúdo sintético — provam que o
// checker realmente pega cada tipo de violação, não só que o estado atual
// do repositório passa (o que também aconteceria com um checker que não
// verifica nada).
Deno.test("architecture guard (self-test): detecta Deno.env em domain/application", () => {
  const violations = analyzeFile(
    "/repo/src/contexts/chat/application/use-cases/Foo.ts",
    `const x = Deno.env.get("X");`,
  );
  assertEquals(violations, ['usa Deno.env diretamente']);
});

Deno.test("architecture guard (self-test): detecta import de infraestrutura", () => {
  const violations = analyzeFile(
    "/repo/src/contexts/chat/application/use-cases/Foo.ts",
    `import { X } from "../../infrastructure/adapters/X.ts";`,
  );
  assertEquals(violations, ['importa infraestrutura: ../../infrastructure/adapters/X.ts']);
});

Deno.test("architecture guard (self-test): detecta import de serviço legado", () => {
  const violations = analyzeFile(
    "/repo/src/contexts/chat/application/use-cases/Foo.ts",
    `import { billingService } from "../../../../services/billingService.ts";`,
  );
  assertEquals(violations, ['importa serviço legado: ../../../../services/billingService.ts']);
});

Deno.test("architecture guard (self-test): detecta dependência direta de application/ de outro contexto", () => {
  const violations = analyzeFile(
    "/repo/src/contexts/chat/application/use-cases/Foo.ts",
    `import { BillingUseCases } from "../../../wallet-billing/application/use-cases/BillingUseCases.ts";`,
  );
  assertEquals(violations.length, 1);
  assertEquals(violations[0].includes("depende diretamente do contexto 'wallet-billing'"), true);
});

Deno.test("architecture guard (self-test): permite domain -> domain entre contextos (shared kernel)", () => {
  const violations = analyzeFile(
    "/repo/src/contexts/chat/application/use-cases/Foo.ts",
    `import { compactHistory } from "../../cache/domain/ChatHistoryCompactor.ts";`,
  );
  assertEquals(violations, []);
});

Deno.test("architecture guard (self-test): detecta domain importando application do mesmo contexto", () => {
  const violations = analyzeFile(
    "/repo/src/contexts/chat/domain/ChatSession.ts",
    `import { ChatUseCases } from "../application/use-cases/ChatUseCases.ts";`,
  );
  assertEquals(violations, ['domain importa application (direção invertida): ../application/use-cases/ChatUseCases.ts']);
});

Deno.test("architecture guard (self-test): não acusa nada num arquivo limpo", () => {
  const violations = analyzeFile(
    "/repo/src/contexts/chat/application/use-cases/Foo.ts",
    `import { ChatSession } from "../../domain/ChatSession.ts";\nimport { ChatSessionRepository } from "../ports/out/ChatSessionRepository.ts";`,
  );
  assertEquals(violations, []);
});
