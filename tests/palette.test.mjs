import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

function luminance(hex) {
  const channels = hex.match(/[a-f\d]{2}/gi).map((value) => parseInt(value, 16) / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

test("every provider palette has six strictly increasing lightness levels", async () => {
  const source = await readFile(new URL("../lib/activity/palette.ts", import.meta.url), "utf8");
  const rows = [...source.matchAll(/(?:"[^"]+"|\w+): \[(.*?)\]/g)].map((match) => [...match[1].matchAll(/#[0-9a-f]{6}/gi)].map((color) => color[0]));
  assert.equal(rows.length, 5);
  for (const palette of rows) {
    assert.equal(palette.length, 6);
    const values = palette.map(luminance);
    assert.ok(values.every((value, index) => index === 0 || value > values[index - 1]), `non-monotonic palette: ${palette.join(", ")}`);
  }
  assert.equal(new Set(rows.map((row) => row.at(-1))).size, 5);
});
