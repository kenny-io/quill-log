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
 * Human-readable formatter for local development:
 * `12:04:05 WARN slow upstream ms=1840`.
 * @param {object} record
 */
export function prettyFormatter(record) {
  const { level, msg, time, ...fields } = record;
  const clock = time.slice(11, 19);
  const extras = Object.entries(fields)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join(" ");
  process.stdout.write(
    `${clock} ${level.toUpperCase().padEnd(5)} ${msg}${extras ? " " + extras : ""}\n`
  );
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
  let level = options.level ?? "info";
  const formatter = options.formatter ?? jsonFormatter;
  const base = options.base ?? {};

  const emit = (lvl, msg, fields = {}) => {
    if (LEVELS[lvl] < LEVELS[level]) return;
    formatter({ level: lvl, msg, time: new Date().toISOString(), ...base, ...fields });
  };

  return {
    debug: (msg, fields) => emit("debug", msg, fields),
    info: (msg, fields) => emit("info", msg, fields),
    warn: (msg, fields) => emit("warn", msg, fields),
    error: (msg, fields) => emit("error", msg, fields),

    /**
     * Whether a record at this level would be emitted. Use to skip building
     * expensive log fields that would be dropped anyway.
     * @param {"debug"|"info"|"warn"|"error"} lvl
     * @returns {boolean}
     */
    isLevelEnabled(lvl) {
      return lvl in LEVELS && LEVELS[lvl] >= LEVELS[level];
    },

    /**
     * The current minimum level.
     * @returns {"debug"|"info"|"warn"|"error"}
     */
    level() {
      return level;
    },

    /**
     * Change the minimum level at runtime (e.g. flip to "debug" while
     * investigating an incident, without recreating the logger).
     * @param {"debug"|"info"|"warn"|"error"} next
     */
    setLevel(next) {
      if (!(next in LEVELS)) throw new RangeError(`unknown level: ${next}`);
      level = next;
    },

    /**
     * Create a child logger whose records include extra base fields.
     * @param {object} fields
     */
    child(fields) {
      return createLogger({ level, formatter, base: { ...base, ...fields } });
    },
  };
}
