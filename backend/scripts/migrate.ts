import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import "https://deno.land/std@0.224.0/dotenv/load.ts";

const dbUrl = Deno.env.get("DATABASE_URL");

if (!dbUrl) {
  console.error("Error: DATABASE_URL is not set in .env");
  console.log(
    "Please add DATABASE_URL=postgresql://postgres:password@host:port/postgres to your .env file"
  );
  console.log("Or run the SQL manually in your Supabase Dashboard.");
  Deno.exit(1);
}

const client = new Client(dbUrl);

try {
  await client.connect();
  console.log("Connected to database.");

  const migrationFile =
    "./supabase/migrations/20241203_create_billing_schema.sql";
  const sql = await Deno.readTextFile(migrationFile);

  console.log(`Applying migration: ${migrationFile}`);
  await client.queryArray(sql);

  console.log("Migration applied successfully!");
} catch (error) {
  console.error("Migration failed:", error);
} finally {
  await client.end();
}
