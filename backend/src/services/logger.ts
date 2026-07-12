import { log } from "../deps.ts";

const LOG_LEVEL = (
  Deno.env.get("LOG_LEVEL") || "INFO"
).toUpperCase() as log.LevelName;

await log.setup({
  handlers: {
    console: new log.ConsoleHandler(LOG_LEVEL, {
      formatter: (record) => `${record.levelName} ${record.msg}`,
    }),
  },

  loggers: {
    default: {
      level: LOG_LEVEL,
      handlers: ["console"],
    },
  },
});

export default log.getLogger();
