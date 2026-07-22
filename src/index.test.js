import test from "node:test";
import assert from "node:assert/strict";

import { createLogger, tee } from "./index.js";

/** Collect records in memory instead of writing to stdout. */
function collector() {
  const records = [];
  return { records, formatter: (record) => records.push(record) };
}

test("levels filter and setLevel changes at runtime", () => {
  const { records, formatter } = collector();
  const log = createLogger({ level: "warn", formatter });

  log.info("dropped");
  log.warn("kept");
  assert.equal(records.length, 1);

  assert.equal(log.isLevelEnabled("debug"), false);
  log.setLevel("debug");
  assert.equal(log.isLevelEnabled("debug"), true);
  log.debug("now visible");
  assert.equal(records.length, 2);
  assert.throws(() => log.setLevel("loud"), RangeError);
});

test("redact masks configured keys at any depth, case-insensitively", () => {
  const { records, formatter } = collector();
  const log = createLogger({ formatter, redact: ["password", "token"] });

  log.info("login", {
    user: "kenny",
    Password: "hunter2",
    auth: { token: "abc123", scheme: "bearer" },
  });

  assert.equal(records[0].Password, "[redacted]");
  assert.equal(records[0].auth.token, "[redacted]");
  assert.equal(records[0].auth.scheme, "bearer");
  assert.equal(records[0].user, "kenny");
});

test("Error values serialize to plain objects", () => {
  const { records, formatter } = collector();
  const log = createLogger({ formatter });
  const cause = new Error("root");
  const err = new Error("boom", { cause });

  log.error("upstream failed", { err });

  assert.equal(records[0].err.message, "boom");
  assert.equal(records[0].err.name, "Error");
  assert.ok(records[0].err.stack.includes("boom"));
  assert.equal(records[0].err.cause.message, "root");
});

test("circular fields are cut, not thrown", () => {
  const { records, formatter } = collector();
  const log = createLogger({ formatter });
  const loop = { name: "a" };
  loop.self = loop;

  log.info("cycle", { loop });
  assert.equal(records[0].loop.self, "[circular]");
  assert.doesNotThrow(() => JSON.stringify(records[0]));
});

test("time() logs a durationMs field", async () => {
  const { records, formatter } = collector();
  const log = createLogger({ formatter });

  const end = log.time("job finished");
  await new Promise((resolve) => setTimeout(resolve, 15));
  end({ jobId: 7 });

  assert.equal(records[0].msg, "job finished");
  assert.equal(records[0].jobId, 7);
  assert.ok(records[0].durationMs >= 10);
});

test("tee fans records out to every sink", () => {
  const a = collector();
  const b = collector();
  const log = createLogger({ formatter: tee(a.formatter, b.formatter) });

  log.info("hello");
  assert.equal(a.records.length, 1);
  assert.equal(b.records.length, 1);
});

test("child inherits redaction and base fields", () => {
  const { records, formatter } = collector();
  const log = createLogger({
    formatter,
    base: { service: "checkout" },
    redact: ["secret"],
  });

  log.child({ requestId: "r1" }).info("step", { secret: "x" });

  assert.equal(records[0].service, "checkout");
  assert.equal(records[0].requestId, "r1");
  assert.equal(records[0].secret, "[redacted]");
});
