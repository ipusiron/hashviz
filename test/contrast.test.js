import test from 'node:test';
import assert from 'node:assert/strict';
import { read } from './load.js';

const css = read('style.css');

function block(selector) {
  const start = css.indexOf(`${selector} {`);
  assert.ok(start >= 0, selector);
  return css.slice(start, css.indexOf('}', start));
}

const tokens = (selector) => Object.fromEntries([...block(selector).matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})/g)].map((m) => [m[1], m[2]]));

const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// 文字の色と背景の色の組（画面で実際に重なるもの）。4.5:1 以上
const TEXT = [
  ['text', 'bg'], ['text', 'card'], ['text', 'surface'], ['text', 'field-bg'], ['text', 'accent-weak'],
  ['muted', 'bg'], ['muted', 'card'], ['muted', 'surface'], ['muted', 'accent-weak'],
  ['accent-text', 'bg'], ['accent-text', 'card'], ['accent-text', 'surface'], ['accent-text', 'accent-weak'],
  ['on-accent', 'accent'],
  ['ok-text', 'ok-bg'], ['ok-text', 'card'], ['warn-text', 'warn-bg'], ['info-text', 'info-bg'], ['chg-text', 'chg-bg']
];
// 入力欄の枠・選択中のタブの線・ビットの図（1と0のマス、違うビットと同じビット、印とマス）。3:1 以上（WCAG 1.4.11）
const GRAPHICS = [
  ['field-border', 'card'], ['field-border', 'bg'], ['field-border', 'field-bg'],
  ['accent', 'card'], ['accent', 'bg'], ['accent', 'surface'],
  ['bit-one', 'bit-zero'], ['bit-diff', 'bit-same'], ['bit-mark', 'bit-one'], ['bit-mark', 'bit-zero'], ['bit-one', 'scene-bg'], ['bit-zero', 'scene-bg'],
  ['bit-diff', 'card'], ['sac-low', 'sac-mid'], ['sac-high', 'sac-mid']
];

test('ライトとダークの配色は、文字と背景が4.5:1以上、枠とビットの図が3:1以上', () => {
  for (const [name, set] of [['light', tokens(':root')], ['dark', tokens(':root[data-theme="dark"]')]]) {
    for (const [fg, bg] of TEXT) assert.ok(ratio(set[fg], set[bg]) >= 4.5, `${name} ${fg} on ${bg}: ${ratio(set[fg], set[bg]).toFixed(2)}`);
    for (const [fg, bg] of GRAPHICS) assert.ok(ratio(set[fg], set[bg]) >= 3, `${name} ${fg} on ${bg}: ${ratio(set[fg], set[bg]).toFixed(2)}`);
  }
});

test('OS の設定によるダークと、手動のダークは同じ値', () => {
  const read2 = (sel) => Object.fromEntries([...block(sel).matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
  const os = read2(':root:not([data-theme="light"])');
  assert.ok(Object.keys(os).length >= 28, String(Object.keys(os).length));
  assert.deepEqual(os, read2(':root[data-theme="dark"]'));
  assert.deepEqual(Object.keys(read2(':root')).sort(), Object.keys(os).sort());
});

test('描画が読む色のトークンは、ライト・ダークの両方にある', () => {
  const draw = read('js/draw.js');
  const used = [...new Set([...draw.matchAll(/'--([a-z-]+)'/g)].map((m) => m[1]))];
  assert.ok(used.length >= 9, used.join());
  for (const sel of [':root', ':root[data-theme="dark"]']) for (const k of used) assert.ok(tokens(sel)[k], `${sel} ${k}`);
});

test('操作するボタン・タブ・入力欄は高さ44px以上、入力欄の文字は16px、チェックボックスは24px', () => {
  for (const sel of ['.icon-btn', '.tab-btn', '.btn', '.site-footer a', '.select', '.check-row']) assert.match(block(sel), /min-height: 44px/, sel);
  assert.match(block('.select'), /font-size: 16px/);
  const field = block('.text-input,\n.text-area');
  assert.match(field, /min-height: 44px/);
  assert.match(field, /font-size: 16px/);
  assert.match(block('.check-row input'), /width: 24px;\s*height: 24px/);
});

test('グリッドは minmax(0, 1fr)（長い行が列を押し広げない）。図は幅に合わせて縮む（固定の 400px を使わない）', () => {
  assert.match(block('.grid.two'), /grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\)/);
  assert.match(block('.grid.three'), /grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\) minmax\(0, 1fr\)/);
  assert.match(block('.bits'), /width: 100%;[\s\S]*height: auto;/);
  assert.doesNotMatch(css, /width: 400px|height: 400px/);
  assert.match(block('.bits.is-3d'), /touch-action: none;/);
});

test('本文の書体は欧文の書体を先に置く。動きを減らす設定では切り替えのアニメーションを止める。背景は1色', () => {
  assert.match(css, /body \{[^}]*font-family: "Segoe UI", system-ui,/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\* \{ transition: none !important; animation: none !important; \}/);
  assert.match(block('\nbody'), /background: var\(--bg\);/);
  assert.doesNotMatch(css, /gradient/);
});
