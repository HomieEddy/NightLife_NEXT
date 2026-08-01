type LogMeta = Record<string, unknown>;

/** ponytail: console wrapper — swap for structured transport if needed */
export const logger = {
  info(msg: string, meta?: LogMeta) {
    console.log(JSON.stringify({ level: "info", ts: new Date().toISOString(), msg, ...meta }));
  },
  warn(msg: string, meta?: LogMeta) {
    console.warn(JSON.stringify({ level: "warn", ts: new Date().toISOString(), msg, ...meta }));
  },
  error(msg: string, meta?: LogMeta) {
    console.error(JSON.stringify({ level: "error", ts: new Date().toISOString(), msg, ...meta }));
  },
};
