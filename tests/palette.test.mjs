import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

function luminance(hex) {
  const channels = hex.match(/[a-f\d]{2}/gi).map((value) => parseInt(value, 16) / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(first, second) {
  const darker = Math.min(first, second);
  const lighter = Math.max(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

const colorVisionMatrices = {
  protanopia: [[0.56667, 0.43333, 0], [0.55833, 0.44167, 0], [0, 0.24167, 0.75833]],
  deuteranopia: [[0.625, 0.375, 0], [0.7, 0.3, 0], [0, 0.3, 0.7]],
  tritanopia: [[0.95, 0.05, 0], [0, 0.43333, 0.56667], [0, 0.475, 0.525]],
};

// Ramps may run dark-to-light (dark theme) or light-to-dark (light theme); they
// must be strictly monotonic either way so intensity never relies on hue.
function isStrictlyMonotonic(values) {
  const ascending = values.every((value, index) => index === 0 || value > values[index - 1]);
  const descending = values.every((value, index) => index === 0 || value < values[index - 1]);
  return ascending || descending;
}

function simulatedLuminance(hex, matrix) {
  const rgb = hex.match(/[a-f\d]{2}/gi).map((value) => parseInt(value, 16) / 255);
  const simulated = matrix.map((row) => Math.min(1, Math.max(0, row.reduce((total, weight, index) => total + weight * rgb[index], 0))));
  const linear = simulated.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

test("every provider palette has six strictly monotonic lightness levels", async () => {
  const source = await readFile(new URL("../lib/activity/palette.ts", import.meta.url), "utf8");
  const rows = [...source.matchAll(/(?:"[^"]+"|\w+): \[(.*?)\]/g)].map((match) => [...match[1].matchAll(/#[0-9a-f]{6}/gi)].map((color) => color[0]));
  assert.equal(rows.length, 5);
  for (const palette of rows) {
    assert.equal(palette.length, 6);
    const values = palette.map(luminance);
    assert.ok(isStrictlyMonotonic(values), `non-monotonic palette: ${palette.join(", ")}`);
    assert.ok(
      values.every((value, index) => index === 0 || contrast(value, values[index - 1]) >= 1.3),
      `adjacent levels rely too heavily on hue: ${palette.join(", ")}`,
    );
    for (const [vision, matrix] of Object.entries(colorVisionMatrices)) {
      const simulated = palette.map((color) => simulatedLuminance(color, matrix));
      assert.ok(isStrictlyMonotonic(simulated), `non-monotonic ${vision} palette: ${palette.join(", ")}`);
    }
  }
  assert.equal(new Set(rows.map((row) => row.at(-1))).size, 5);
});

test("provider identity and intensity do not rely on hue alone", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const dashboard = await readFile(new URL("../components/activity/ActivityDashboard.tsx", import.meta.url), "utf8");
  const legend = [...styles.matchAll(/--level-[0-5]:\s*(#[0-9a-f]{6})/gi)].map((match) => match[1]);
  const legendLuminance = legend.map(luminance);

  assert.equal(legend.length, 6);
  assert.ok(legendLuminance.every((value, index) => index === 0 || contrast(value, legendLuminance[index - 1]) >= 1.3));
  assert.match(styles, /provider-mark--build-index[^}]*rotate\(45deg\)/);
  assert.match(styles, /provider-mark--github[^}]*border-radius:\s*50%/);
  assert.match(styles, /provider-mark--codex\s*\{[^}]*background/);
  assert.match(styles, /provider-mark--cursor[^}]*border-radius:[^}]*rotate\(45deg\)/);
  assert.match(styles, /provider-mark--claude-code[^}]*clip-path:\s*polygon/);
  assert.match(dashboard, /Intensity level \$\{level\} of 5/);
});
