import * as log from "https://deno.land/std@0.224.0/log/mod.ts";

// Deno standard library
export * as dotenv from "https://deno.land/std@0.224.0/dotenv/mod.ts";
export { v1 as uuidv1, v4 as uuidv4 } from "https://deno.land/std@0.224.0/uuid/mod.ts";

// Third-party libraries
export {
  Application,
  Router,
  type Middleware,
} from "https://deno.land/x/oak@v16.1.0/mod.ts";
export { oakCors } from "https://deno.land/x/cors@v1.2.2/mod.ts";
export { create, verify, type Header, type Payload } from "https://deno.land/x/djwt@v3.0.2/mod.ts";
export { Application, Router, Context } from "https://deno.land/x/oak@v12.6.1/mod.ts";
export { oakCors } from "https://deno.land/x/cors@v1.2.2/mod.ts";
export { Polly } from "https://deno.land/x/polly@v0.2.0/mod.ts";
export { config } from "https://deno.land/x/dotenv@v3.2.2/mod.ts";
export { createClient } from "jsr:@supabase/supabase-js@2";

// Using npm modules in Deno
export { GoogleGenerativeAI } from "npm:@google/generative-ai@0.24.1";

export { log };
