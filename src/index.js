/**
 * quill-log — structured, leveled logging with pluggable formatters.
 *
 * Loggers emit structured records ({ level, msg, time, ...fields }) to a
 * formatter. The default formatter prints JSON lines to stdout. Records pass
 * through error serialization and redaction before they reach any formatter,
 * so sinks only ever see plain, safe data.
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

const REDACTED = "[redacted]";

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
 * Fan a record out to several formatters: `tee(jsonFormatter, myAuditSink)`.
 * @param {...(record: object) => void} formatters
 * @returns {(record: object) => void}
 */
export function tee(...formatters) {
  return (record) => {
    for (const formatter of formatters) formatter(record);
  };
}

/** Convert Error values into plain `{ name, message, stack }` objects. */
function serializeValue(value) {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
      ...(value.cause !== undefined
        ? { cause: serializeValue(value.cause) }
        : {}),
    };
  }
  return value;
}

/**
 * Deep-copy fields, masking every property whose key is in `redactKeys` and
 * serializing Error values. Cycle-safe: repeated references are cut with
 * "[circular]".
 */
function sanitizeFields(fields, redactKeys, seen = new WeakSet()) {
  const out = {};
  for (const [key, rawValue] of Object.entries(fields)) {
    if (redactKeys.has(key.toLowerCase())) {
      out[key] = REDACTED;
      continue;
    }
    const value = serializeValue(rawValue);
    if (value && typeof value === "object" && !Array.isArray(value)) {
      if (seen.has(rawValue)) {
        out[key] = "[circular]";
        continue;
      }
      seen.add(rawValue);
      out[key] = sanitizeFields(value, redactKeys, seen);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Create a logger.
 *
 * @param {object} [options]
 * @param {"debug"|"info"|"warn"|"error"} [options.level="info"] - Minimum level to emit.
 * @param {(record: object) => void} [options.formatter=jsonFormatter] - Record sink.
 * @param {object} [options.base] - Fields merged into every record (e.g. service name).
 * @param {Array<string>} [options.redact] - Field names (any depth, case-insensitive) masked as "[redacted]".
 * @returns {object} logger
 */
export function createLogger(options = {}) {
  let level = options.level ?? "info";
  const formatter = options.formatter ?? jsonFormatter;
  const base = options.base ?? {};
  const redactKeys = new Set(
    (options.redact ?? []).map((key) => key.toLowerCase()),
  );

  const emit = (lvl, msg, fields = {}) => {
    if (LEVELS[lvl] < LEVELS[level]) return;
    const merged = { ...base, ...fields };
    formatter({
      level: lvl,
      msg,
      time: new Date().toISOString(),
      ...(redactKeys.size > 0 || hasComplexValue(merged)
        ? sanitizeFields(merged, redactKeys)
        : merged),
    });
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
     * Start a duration timer. The returned function logs `msg` at info with
     * a `durationMs` field (plus any extra fields) when called.
     *
     * @param {string} msg
     * @returns {(fields?: object) => void} end
     */
    time(msg) {
      const startedAt = Date.now();
      return (fields = {}) => {
        emit("info", msg, { durationMs: Date.now() - startedAt, ...fields });
      };
    },

    /**
     * Create a child logger whose records include extra base fields.
     * @param {object} fields
     */
    child(fields) {
      return createLogger({
        level,
        formatter,
        base: { ...base, ...fields },
        redact: [...redactKeys],
      });
    },
  };
}

/** True when any top-level field needs sanitizing (Error or nested object). */
function hasComplexValue(fields) {
  for (const value of Object.values(fields)) {
    if (value instanceof Error) return true;
    if (value && typeof value === "object" && !Array.isArray(value)) return true;
  }
  return false;
}
