import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { read, load } from './load.js';

const html = read('index.html');
const { MESSAGES, t } = load('js/messages.js').HashVizMessages;
const { parseVars } = load('js/i18n.js').HashVizI18n;
const C = load('js/hashviz-core.js').HashVizCore;
const SCRIPTS = ['js/app.js', 'js/draw.js', 'js/hashviz-core.js', 'js/messages.js', 'js/i18n.js', 'js/theme.js', 'js/theme-init.js'];
const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
const TABS = ['avalanche', 'viz', 'collision', 'glossary'];

test('CSP はスクリプト・スタイルを同じ場所のファイルだけに限り、unsafe-inline と外部の通信を許さない', () => {
  const csp = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/)[1];
  assert.equal(csp, "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; "
    + "connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'");
  assert.doesNotMatch(html, /X-Content-Type-Options|X-Frame-Options|X-XSS-Protection|frame-ancestors/i);
  assert.equal((html.match(/http-equiv=/g) || []).length, 1);
  assert.match(html, /<meta name="referrer" content="no-referrer">/);
  assert.match(html, /<link rel="icon" href="data:,">/);
  assert.match(html, /<noscript>/);
});

test('外部のスクリプト（CDN）を読まない。HTML に style 属性・インラインのスクリプト・イベントハンドラーがない', () => {
  assert.doesNotMatch(html, /\sstyle=/);
  assert.doesNotMatch(html, /\son[a-z]+=/i);
  const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
  assert.deepEqual(scripts, ['js/theme-init.js', 'js/hashviz-core.js', 'js/messages.js', 'js/i18n.js', 'js/theme.js', 'js/draw.js', 'js/app.js']);
  assert.equal((html.match(/<script/g) || []).length, scripts.length);
  assert.doesNotMatch(html, /cdn\.|jsdelivr|unpkg|three(\.min)?\.js|md5\.min/i);
  for (const a of html.match(/<a [^>]*>/g)) assert.match(a, /target="_blank" rel="noopener noreferrer"/, a);
  // 読み込むファイルはすべてリポジトリーにある（古いファイルを残さない）
  const js = fs.readdirSync(new URL('../js', import.meta.url)).map((f) => `js/${f}`).sort();
  assert.deepEqual(js, [...scripts].sort());
  assert.equal(fs.existsSync(new URL('../data', import.meta.url)), false);
});

test('タブは WAI-ARIA の形（tablist の中はタブだけ、aria-controls の先が実在、最初のタブだけ選択）', () => {
  const nav = html.match(/<nav class="tabs" role="tablist"[\s\S]*?<\/nav>/)[0];
  assert.equal((nav.match(/<button/g) || []).length, TABS.length);
  const tabs = [...nav.matchAll(/role="tab" id="(tab-[a-z]+)" data-tab="([a-z]+)" aria-controls="(panel-[a-z]+)" aria-selected="(true|false)"/g)];
  assert.deepEqual(tabs.map((m) => [m[2], m[4]]), TABS.map((k, i) => [k, i === 0 ? 'true' : 'false']));
  for (const [, id, , panel, selected] of tabs) {
    const tag = html.match(new RegExp(`<section [^>]*id="${panel}"[^>]*>`))[0];
    assert.match(tag, new RegExp(`role="tabpanel" aria-labelledby="${id}"`), panel);
    assert.equal(/\shidden/.test(tag), selected === 'false', panel);
  }
  for (const m of html.matchAll(/aria-labelledby="([^"]+)"/g)) assert.ok(ids.has(m[1]), m[1]);
  for (const m of html.matchAll(/aria-describedby="([^"]+)"/g)) assert.ok(ids.has(m[1]), m[1]);
});

test('ボタンは type="button"。入力欄には label があり、入力の欄はスペルチェックを切る。チェックボックスは label の中', () => {
  for (const b of html.match(/<button[^>]*>/g)) assert.match(b, /type="button"/, b);
  for (const m of html.matchAll(/<(textarea|select|input) [^>]*id="([^"]+)"/g)) {
    if (/type="checkbox"/.test(m[0])) continue;
    assert.match(html, new RegExp(`<label [^>]*for="${m[2]}"`), m[2]);
  }
  for (const m of html.matchAll(/<input type="checkbox" id="([^"]+)">/g)) {
    assert.match(html, new RegExp(`<label class="check-row"><input type="checkbox" id="${m[1]}"><span data-i18n="`), m[1]);
  }
  for (const id of ['ava-input', 'viz-input', 'col-a', 'col-b']) assert.match(html, new RegExp(`id="${id}"[^>]*spellcheck="false"`), id);
});

test('結果の知らせの欄と、印の一覧には aria-live がある。図はキーボードで選べて、名前を持つ（role="img"）', () => {
  for (const id of ['ava-status', 'viz-status', 'col-status', 'ava-marks', 'viz-marks', 'col-marks']) {
    assert.match(html, new RegExp(`id="${id}"[^>]*aria-live="polite"`), id);
  }
  const canvases = [...html.matchAll(/<canvas id="([^"]+)" class="bits" tabindex="0" role="img"/g)].map((m) => m[1]);
  assert.deepEqual(canvases, ['ava-canvas-a', 'ava-canvas-b', 'ava-canvas-x', 'viz-canvas', 'col-canvas-a', 'col-canvas-b']);
  assert.equal((html.match(/<canvas/g) || []).length, canvases.length);
});

test('アルゴリズム・入力の形式・衝突の組の選択肢は、計算部と同じ値で同じ並び', () => {
  for (const id of ['ava-algo', 'viz-algo', 'col-algo']) {
    const sel = html.match(new RegExp(`<select id="${id}"[\\s\\S]*?</select>`))[0];
    assert.deepEqual([...sel.matchAll(/value="([^"]+)"/g)].map((m) => m[1]), C.ALGOS, id);
  }
  for (const id of ['ava-format', 'viz-format', 'col-format']) {
    const sel = html.match(new RegExp(`<select id="${id}"[\\s\\S]*?</select>`))[0];
    assert.deepEqual([...sel.matchAll(/value="([^"]+)"/g)].map((m) => m[1]), C.FORMATS, id);
  }
  const sel = html.match(/<select id="col-sample"[\s\S]*?<\/select>/)[0];
  assert.deepEqual([...sel.matchAll(/value="([^"]+)"/g)].map((m) => m[1]), C.SAMPLES.map((s) => s.id));
  for (const s of C.SAMPLES) {
    assert.ok(MESSAGES.ja[`note.${s.id}`] && MESSAGES.en[`note.${s.id}`], s.id);
  }
});

// 文言の太字（**）と改行（\n）は HTML の strong と br に当たる。HTML 側のタグを外して比べる
const plain = (s) => s.replace(/\n\s*/g, '').replace(/<br>/g, '\n').replace(/<[^>]+>/g, '')
  .replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').trim();
const fromDict = (s) => s.replace(/\*\*/g, '');

test('data-i18n のキーは辞書にあり、HTML に書いた日本語は辞書の日本語と同じ', () => {
  let n = 0;
  for (const m of html.matchAll(/<([a-z0-9]+)([^>]*?)data-i18n="([^"]+)"([^>]*)>([\s\S]*?)<\/\1>/g)) {
    const key = m[3];
    assert.ok(MESSAGES.ja[key] !== undefined, key);
    const vars = parseVars(((m[2] + m[4]).match(/data-i18n-vars="([^"]*)"/) || [])[1]);
    assert.equal(plain(m[5]), fromDict(t(key, vars, 'ja')), key);
    n++;
  }
  assert.ok(n >= 100, String(n));
  for (const m of html.matchAll(/data-i18n-attr="([^"]+)"/g)) {
    for (const pair of m[1].split(';')) assert.ok(MESSAGES.ja[pair.split(':')[1]] !== undefined, pair);
  }
});

test('画面のスクリプトが参照する id は、すべて HTML にある', () => {
  const src = read('js/app.js');
  const used = [...src.matchAll(/\$\('([a-z0-9-]+)'\)/g)].map((m) => m[1]);
  assert.ok(used.length >= 40, String(used.length));
  for (const id of used) assert.ok(ids.has(id), id);
  // 図のまとまりごとの部品（prefix-3d など）
  for (const p of ['ava', 'viz', 'col']) {
    for (const s of ['3d', 'rotate', 'reset-view', 'clear', 'grid-hint', 'marks']) assert.ok(ids.has(`${p}-${s}`), `${p}-${s}`);
  }
  for (const k of TABS) assert.ok(ids.has(`tab-${k}`) && ids.has(`panel-${k}`), k);
});

test('JS は innerHTML・eval を使わず、style を書き換えず、外と通信しない。console も Math.random も使わない', () => {
  for (const f of SCRIPTS) {
    const src = read(f);
    assert.doesNotMatch(src, /innerHTML|outerHTML|insertAdjacentHTML|DOMParser|\beval\(|new Function|document\.write/, f);
    assert.doesNotMatch(src, /\.style\b|setAttribute\('style'|cssText/, f);
    assert.doesNotMatch(src, /console\.(log|debug|info|error|warn)|\balert\(/, f);
    assert.doesNotMatch(src, /document\.addEventListener\('keydown'/, f);
    assert.doesNotMatch(src, /sessionStorage|Math\.random|fetch\(|XMLHttpRequest|WebSocket|sendBeacon/, f);
  }
});

test('localStorage は try で囲んで読み書きする（使えない環境でも画面が止まらない）', () => {
  let total = 0;
  for (const f of SCRIPTS.filter((x) => x !== 'js/messages.js')) {
    const src = read(f);
    const uses = (src.match(/localStorage\./g) || []).length;
    const guarded = [...src.matchAll(/try \{\s*(?:const [a-z]+ = |return )?localStorage\./g)].length;
    assert.equal(guarded, uses, f);
    total += uses;
  }
  assert.equal(total, 4);
});

test('自動回転は requestAnimationFrame を1カ所でだけ使い、止める条件（3D・タブ・ページの表示）を見る', () => {
  const src = read('js/app.js');
  assert.equal((src.match(/requestAnimationFrame\(step\)/g) || []).length, 2);
  assert.match(src, /const spinning = \(g\) => g\.rotate && g\.threeD && visibleGroup\(g\) && !document\.hidden && bitCount\(g\) > 0;/);
  assert.match(src, /cancelAnimationFrame\(g\.raf\)/);
  assert.match(src, /document\.addEventListener\('visibilitychange'/);
  // 既定では回さない
  assert.doesNotMatch(html, /id="[a-z]+-rotate" checked/);
});
