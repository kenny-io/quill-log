# quill-log

Structured, leveled logging for Node.js with pluggable formatters.

## Install

```bash
npm install quill-log
```

## Usage

```js
import { createLogger } from "quill-log";

const log = createLogger({ level: "info", base: { service: "checkout" } });

log.info("order placed", { orderId: "ord_123" });
// {"level":"info","msg":"order placed","time":"…","service":"checkout","orderId":"ord_123"}

const reqLog = log.child({ requestId: "req_456" });
reqLog.warn("slow upstream", { ms: 1840 });
```

## API

- `createLogger(options?)` — `level` (default `"info"`), `formatter` (default `jsonFormatter`), `base` fields merged into every record.
- `log.debug/info/warn/error(msg, fields?)` — emit a record if at or above the configured level.
- `log.child(fields)` — derive a logger with extra base fields.
- `log.setLevel(level)` — change the minimum level at runtime; throws `RangeError` on unknown levels.
- `log.level()` — the current minimum level.
- `jsonFormatter(record)` — the default JSON-lines stdout sink; write your own to send records elsewhere.
- `prettyFormatter(record)` — human-readable single-line output for local development (`12:04:05 WARN slow upstream ms=1840`).

## License

MIT
