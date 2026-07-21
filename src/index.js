/**
 * quill-log — structured, leveled logging with pluggable formatters.
 *
 * Loggers emit structured records ({ level, msg, time, ...fields }) to a
 * formatter. The default formatter prints JSON lines to stdout.
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

/**
 * The default formatter: JSON lines on stdout.
 * @param {object} record
 */
export function jsonFormatter(record) {
  process.stdout.write(JSON.stringify(record) + "\n");
}

/**
 * Create a logger.
 *
 * @param {object} [options]
 * @param {"debug"|"info"|"warn"|"error"} [options.level="info"] - Minimum level to emit.
 * @param {(record: object) => void} [options.formatter=jsonFormatter] - Record sink.
 * @param {object} [options.base] - Fields merged into every record (e.g. service name).
 * @returns {object} logger with debug/info/warn/error and child()
 */
export function createLogger(options = {}) {
  const level = options.level ?? "info";
  const formatter = options.formatter ?? jsonFormatter;
  const base = options.base ?? {};
  const threshold = LEVELS[level];

  const emit = (lvl, msg, fields = {}) => {
    if (LEVELS[lvl] < threshold) return;
    formatter({ level: lvl, msg, time: new Date().toISOString(), ...base, ...fields });
  };

  return {
    debug: (msg, fields) => emit("debug", msg, fields),
    info: (msg, fields) => emit("info", msg, fields),
    warn: (msg, fields) => emit("warn", msg, fields),
    error: (msg, fields) => emit("error", msg, fields),

    /**
     * Create a child logger whose records include extra base fields.
     * @param {object} fields
     */
    child(fields) {
      return createLogger({ level, formatter, base: { ...base, ...fields } });
    },
  };
}
