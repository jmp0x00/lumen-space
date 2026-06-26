import test from "node:test";
import assert from "node:assert/strict";
import { generateDisplayNameSync, generateFallbackName } from "../docs/app/src/names.js";

test("fallback names are deterministic and readable", () => {
  const first = generateFallbackName("lumen-seed");
  const second = generateFallbackName("lumen-seed");

  assert.equal(first, second);
  assert.match(first, /^[A-Z][a-z]+ [A-Z][a-z]+$/);
});

test("sync display names use the local fallback before the external generator loads", () => {
  const name = generateDisplayNameSync("bot-seed");

  assert.equal(name, generateFallbackName("bot-seed"));
});
