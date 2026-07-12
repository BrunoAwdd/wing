import { generateTextStream } from "../src/services/aiService";
import * as fs from "fs/promises";
import * as path from "path";
import {
  buildFixPrompt,
  buildTranslatePrompt,
  buildSummarizePrompt,
  buildRewritePrompt,
  PromptBuilder,
} from "../src/prompts";

// Define as constantes de caminho
const BASE_DIR = __dirname;
const GOLDEN_SETS_DIR = path.join(BASE_DIR, "golden-sets");
const LOGS_DIR = path.join(BASE_DIR, "logs");
const LOG_FILE = path.join(
  LOGS_DIR,
  `evaluation-run-${new Date().toISOString()}.jsonl`
);

// Mapeia o nome da tarefa para a função de construção de prompt correspondente
const promptBuilderMapping: { [key: string]: PromptBuilder } = {
  fix: buildFixPrompt,
  translate: buildTranslatePrompt,
  summarize: buildSummarizePrompt,
  rewrite: buildRewritePrompt,
};

/**
 * Itera sobre o gerador de stream e retorna o texto completo.
 */
async function collectStream(stream: AsyncGenerator<string>): Promise<string> {
  let content = "";
  for await (const chunk of stream) {
    content += chunk;
  }
  return content;
}

/**
 * Executa a avaliação para uma determinada tarefa.
 */
async function runEvaluationForTask(task: string, entitlement: string) {
  const taskDir = path.join(GOLDEN_SETS_DIR, task);

  try {
    const files = await fs.readdir(taskDir);
    console.log(
      `Encontrados ${files.length} arquivos de teste para a tarefa: ${task}`
    );

    for (const file of files) {
      if (file.endsWith(".in.txt")) {
        const inputId = path.basename(file, ".in.txt");
        const inputPath = path.join(taskDir, file);
        const inputText = await fs.readFile(inputPath, "utf-8");

        const promptBuilder = promptBuilderMapping[task];
        if (!promptBuilder) {
          throw new Error(
            `Nenhum prompt builder encontrado para a tarefa: ${task}`
          );
        }
        const prompt = promptBuilder(inputText);

        console.log(
          `Processando: ${inputId} (${task}) com entitlement: ${entitlement}`
        );

        const startTime = Date.now();
        const stream = generateTextStream(prompt, entitlement);
        const outputText = await collectStream(stream);
        const endTime = Date.now();
        const latencyMs = endTime - startTime;

        const logEntry = {
          id: inputId,
          task: task,
          entitlement: entitlement,
          latencyMs: latencyMs,
          prompt: prompt,
          input: inputText,
          output: outputText,
          timestamp: new Date().toISOString(),
        };

        // Adiciona a entrada ao arquivo de log
        await fs.appendFile(LOG_FILE, JSON.stringify(logEntry) + "\n");
      }
    }
    console.log(`Resultados da tarefa "${task}" salvos em ${LOG_FILE}`);
  } catch (error) {
    console.error(`Erro ao processar a tarefa "${task}":`, error);
  }
}

/**
 * Função principal que inicia o processo de avaliação.
 */
async function main() {
  try {
    // Pega o entitlement da linha de comando, com 'Free' como padrão
    const entitlement = process.argv[2] || "Free";
    if (entitlement !== "Free" && entitlement !== "Paid") {
      console.error("Entitlement inválido. Use 'Free' ou 'Paid'.");
      process.exit(1);
    }

    await fs.mkdir(LOGS_DIR, { recursive: true });
    console.log(
      `Iniciando a avaliação com o nível de acesso: ${entitlement}...`
    );

    // Executa a avaliação para todas as tarefas
    await runEvaluationForTask("fix", entitlement);
    await runEvaluationForTask("translate", entitlement);
    await runEvaluationForTask("summarize", entitlement);
    await runEvaluationForTask("rewrite", entitlement);

    console.log("Avaliação concluída.");
  } catch (error) {
    console.error("Ocorreu um erro durante a avaliação:", error);
  }
}

main();
