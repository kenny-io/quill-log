# quill-log

Structured, leveled logging for Node.js with pluggable formatters, built-in
secret redaction, and safe error serialization. Zero dependencies.

## Install

```bash
npm install quill-log
```

## Usage

```js
import { createLogger, prettyFormatter, tee } from "quill-log";

const log = createLogger({
  level: "info",
  base: { service: "checkout" },
  redact: ["password", "token", "cardNumber"],
});

log.info("order placed", { orderId: "ord_123" });
// {"level":"info","msg":"order placed","time":"…","service":"checkout","orderId":"ord_123"}

log.error("upstream failed", { err: new Error("timeout") });
// err serializes to { name, message, stack } — never "[object Object]"

const end = log.time("invoice sync");
await syncInvoices();
end({ count: 42 }); // logs durationMs automatically
```

## API

### Loggers

- `createLogger(options?)` — `level` (default `"info"`), `formatter` (default `jsonFormatter`), `base` fields merged into every record, `redact` field names masked at any depth (case-insensitive).
- `log.debug/info/warn/error(msg, fields?)` — emit a record if at or above the configured level.
- `log.child(fields)` — derive a logger with extra base fields; inherits level, formatter, and redaction.

### Levels

- `log.level()` — the current minimum level.
- `log.setLevel(level)` — change the minimum level at runtime; throws `RangeError` on unknown levels.
- `log.isLevelEnabled(level)` — whether a record at that level would be emitted; use it to skip building expensive fields.

### Timing

- `log.time(msg)` — start a timer; the returned `end(fields?)` function logs `msg` at info with a `durationMs` field.

### Record safety

Records are sanitized before any formatter sees them:

- Keys listed in `redact` become `"[redacted]"` — at any nesting depth, case-insensitively.
- `Error` values (including `cause` chains) serialize to `{ name, message, stack }`.
- Circular references are cut with `"[circular]"`, so records always survive `JSON.stringify`.

### Formatters

- `jsonFormatter(record)` — the default JSON-lines stdout sink.
- `prettyFormatter(record)` — human-readable single-line output for local development (`12:04:05 WARN slow upstream ms=1840`).
- `tee(...formatters)` — fan each record out to several sinks (e.g. stdout plus an audit stream).
- Any `(record) => void` function works as a formatter.

## Testing

```bash
npm test
```

## License

MIT
