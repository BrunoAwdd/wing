import { AgentManifest } from "./agentsService.ts";
import { join } from "https://deno.land/std@0.224.0/path/mod.ts";
import { supabase } from "./supabaseClient.ts";

export interface WingExtensionManifest {
  id: string;
  version: string;
  type: "agent" | "tool" | "ui-panel";
  config: any;
}

export interface CustomAgentConfig {
  manifest: AgentManifest;
  visibleName: string;
  category?: string;
}

export class ExtensionRegistry {
  private agents: Map<string, AgentManifest> = new Map();
  private extensionsDir: string;

  constructor(extensionsDir: string = "./extensions") {
    this.extensionsDir = extensionsDir;
  }

  async loadExtensions() {
    console.log(
      `[ExtensionRegistry] Scanning for extensions in ${this.extensionsDir}...`
    );

    // 1. Load Core Extensions from File System (Plugins, Tools)
    await this.loadExtensionsFromDir(this.extensionsDir);
    // REMOVED: await this.loadExtensionsFromDir(`${this.extensionsDir}/user-generated`);

    // 2. Load User Agents from Supabase (Database)
    await this.loadExtensionsFromDatabase();
  }

  private async loadExtensionsFromDatabase() {
    try {
      // Assuming 'supabase' is imported or available globally
      const { data: agents, error } = await supabase.from("agents").select("*");

      if (error) {
        console.error(
          "[ExtensionRegistry] Failed to fetch agents from DB:",
          error
        );
        return;
      }

      if (agents) {
        for (const agentRecord of agents) {
          // Avoid overwriting local agents if they have the same ID (Local takes precedence for dev?)
          // Or DB takes precedence? Let's say DB is the source of truth for user agents.
          const manifest = agentRecord.manifest;
          if (manifest && manifest.config && manifest.config.manifest) {
            console.log(
              `[ExtensionRegistry] Loading agent from DB: ${agentRecord.id}`
            );
            this.registerAgent(manifest.config.manifest);
          }
        }
      }
    } catch (err) {
      console.error("[ExtensionRegistry] DB Load Error:", err);
    }
  }

  private async loadExtensionsFromDir(dirPath: string) {
    try {
      // Check if directory exists
      try {
        await Deno.stat(dirPath);
      } catch (error) {
        if (error instanceof Deno.errors.NotFound) {
          console.log(
            `[ExtensionRegistry] Extensions directory not found: ${dirPath}. Creating...`
          );
          await Deno.mkdir(dirPath, { recursive: true });
        } else {
          throw error; // Re-throw other errors
        }
        return;
      }

      for await (const entry of Deno.readDir(dirPath)) {
        if (entry.isDirectory) {
          await this.loadExtensionFromDir(join(dirPath, entry.name));
        }
      }
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) {
        console.error("[ExtensionRegistry] Failed to load extensions:", error);
      }
    }
  }

  private async loadExtensionFromDir(dirPath: string) {
    try {
      const manifestPath = join(dirPath, "manifest.json");
      const manifestContent = await Deno.readTextFile(manifestPath);
      const manifest: WingExtensionManifest = JSON.parse(manifestContent);

      console.log(
        `[ExtensionRegistry] Loading extension: ${manifest.id} (${manifest.type})`
      );

      if (manifest.type === "agent") {
        const config = manifest.config as CustomAgentConfig;
        this.registerAgent(config.manifest);
      }
    } catch (error) {
      // Ignore if manifest doesn't exist (empty folder)
      if (!(error instanceof Deno.errors.NotFound)) {
        console.warn(
          `[ExtensionRegistry] Failed to load extension from ${dirPath}:`,
          error
        );
      }
    }
  }

  registerAgent(agent: AgentManifest) {
    if (this.agents.has(agent.id)) {
      console.warn(
        `[ExtensionRegistry] Overwriting existing agent: ${agent.id}`
      );
    }
    this.agents.set(agent.id, agent);
    console.log(`[ExtensionRegistry] Registered agent: ${agent.id}`);
  }

  getAgents(): Record<string, AgentManifest> {
    return Object.fromEntries(this.agents);
  }

  async createAgentExtension(manifest: WingExtensionManifest): Promise<void> {
    const userGenDir = `${this.extensionsDir}/user-generated`;
    const agentDir = `${userGenDir}/${manifest.id}`;

    try {
      // 1. Save to File System (Backup/Local Cache)
      await Deno.mkdir(agentDir, { recursive: true });
      await Deno.writeTextFile(
        `${agentDir}/manifest.json`,
        JSON.stringify(manifest, null, 2)
      );

      console.log(
        `[ExtensionRegistry] Created new agent extension at ${agentDir}`
      );

      // 2. Save to Supabase
      // Assuming 'supabase' is imported or available globally
      const { data, error } = await supabase
        .from("agents")
        .upsert({
          id: manifest.id,
          name: manifest.config.visibleName,
          category: manifest.config.category,
          system_prompt:
            (manifest.config as any).manifest.system_prompt ||
            (manifest.config as any).manifest.system,
          manifest: manifest,
          updated_at: new Date().toISOString(),
        })
        .select();

      if (error) {
        console.error("[ExtensionRegistry] Failed to save agent to DB:", error);
        // Don't throw, as FS save succeeded. Just warn.
      } else {
        console.log(
          `[ExtensionRegistry] Saved agent to Supabase: ${manifest.id}`,
          data
        );
      }

      // Hot reload: Register immediately
      if (manifest.type === "agent" && manifest.config.manifest) {
        this.registerAgent(manifest.config.manifest);
      }
    } catch (error) {
      console.error(
        `[ExtensionRegistry] Failed to create agent extension:`,
        error
      );
      throw error;
    }
  }
}

export const extensionRegistry = new ExtensionRegistry();
