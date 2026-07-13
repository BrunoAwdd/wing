import { createClient } from "../deps.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_KEY");
// As tabelas do Wing (accounts, licences, telemetry_events etc.) vivem no
// schema "wing" (mesmo schema referenciado em DATABASE_URL), não em "public"
// — sem isso o PostgREST procura as tabelas no schema errado.
const supabaseSchema = Deno.env.get("SUPABASE_SCHEMA") || "public";

if (!supabaseUrl || !supabaseKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in the environment variables.");
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: supabaseSchema },
});
