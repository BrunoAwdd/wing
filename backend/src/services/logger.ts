import { log } from "../deps.ts";

const LOG_LEVEL = (
  Deno.env.get("LOG_LEVEL") || "INFO"
).toUpperCase() as log.LevelName;

const isProduction = Deno.env.get("NODE_ENV") === "production";

// Em produção, logs saem em JSON (uma linha por evento) para dar para
// agregar/consultar depois (journalctl -u wing-backend -o cat | jq); em dev,
// texto simples é mais legível no terminal.
const formatter = isProduction
  ? (record: log.LogRecord) =>
    JSON.stringify({
      timestamp: record.datetime.toISOString(),
      level: record.levelName,
      message: record.msg,
    })
  : (record: log.LogRecord) => `${record.levelName} ${record.msg}`;

await log.setup({
  handlers: {
    console: new log.ConsoleHandler(LOG_LEVEL, { formatter }),
  },

  loggers: {
    default: {
      level: LOG_LEVEL,
      handlers: ["console"],
    },
  },
});

export default log.getLogger();
