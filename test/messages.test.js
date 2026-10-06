import test from 'node:test';
import assert from 'node:assert/strict';
import { read, load, core } from './load.js';

const { MESSAGES, t } = load('js/messages.js').HashVizMessages;
const C = core();
// かな・カタカナ・漢字・全角の記号
const JAPANESE = new RegExp('[' + [[0x3000, 0x303f], [0x3040, 0x30ff], [0x3400, 0x9fff], [0xff00, 0xffef]]
  .map(([a, b]) => String.fromCharCode(a) + '-' + String.fromCharCode(b)).join('') + ']');

const placeholders = (s) => [...s.matchAll(/\{([a-zA-Z0-9]+)\}/g)].map((m) => m[1]).sort();

test('日本語と英語の辞書は同じキーを持ち、置き場所 {name} と太字の数もそろう', () => {
  assert.deepEqual(Object.keys(MESSAGES.en).sort(), Object.keys(MESSAGES.ja).sort());
  assert.ok(Object.keys(MESSAGES.ja).length >= 150, String(Object.keys(MESSAGES.ja).length));
  for (const k of Object.keys(MESSAGES.ja)) {
    assert.deepEqual(placeholders(MESSAGES.en[k]), placeholders(MESSAGES.ja[k]), k);
    for (const lang of ['ja', 'en']) assert.equal((MESSAGES[lang][k].match(/\*\*/g) || []).length % 2, 0, `${lang} ${k}`);
  }
});

test('英語の辞書に日本語の文字がない（言語の切り替えボタンの「日本語」を除く）', () => {
  for (const [k, v] of Object.entries(MESSAGES.en)) {
    if (k === 'ui.langButton' || k === 'ui.langLabel') continue;
    assert.doesNotMatch(v, JAPANESE, k);
  }
});

test('日本語の文言は、日本語と英数字のあいだに半角空白を入れない。長音をそろえ、「わかる」はひらがな', () => {
  const bad = new RegExp(`(${JAPANESE.source} [A-Za-z0-9(])|([A-Za-z0-9)] ${JAPANESE.source})`);
  for (const [k, v] of Object.entries(MESSAGES.ja)) {
    assert.doesNotMatch(v, bad, k);
    assert.doesNotMatch(v, /ブラウザ(?!ー)|フォルダ(?!ー)|リポジトリ(?!ー)|ディレクトリ(?!ー)|サーバ(?!ー)|エディタ(?!ー)|ユーザ(?!ー)/, k);
    assert.doesNotMatch(v, /(?<![自0-9０-９])分か(?!れ)/, k);
    assert.doesNotMatch(v, new RegExp(`${JAPANESE.source}:`), k);
    // 数＋「カ所」（か所・ヶ所・箇所は使わない）
    assert.doesNotMatch(v, /[0-9}]\s*(か所|ヶ所|箇所)/, k);
  }
});

test('画面のスクリプトが使う文言のキーは、すべて辞書にある（衝突の組・判定・エラーのキーも）', () => {
  const src = read('js/app.js');
  const keys = new Set([...src.matchAll(/\bt\('([a-zA-Z0-9.-]+)'/g)].map((m) => m[1]));
  for (const m of src.matchAll(/(?:key: |: )'((?:err|name|label|stats|ava|col|grid|hint)\.[a-zA-Z0-9.]+)'/g)) keys.add(m[1]);
  assert.ok(keys.size >= 30, String(keys.size));
  for (const s of C.SAMPLES) keys.add(`note.${s.id}`).add(`sample.${s.id}`);
  for (const v of ['within', 'low', 'high']) keys.add(`ava.${v}`);
  for (const k of keys) for (const lang of ['ja', 'en']) assert.ok(MESSAGES[lang][k] !== undefined, `${lang} ${k}`);
});

test('文言に書いた数は、計算部と一次資料に合う（衝突の組の長さ・違うバイト数・理論の範囲）', () => {
  const ja = MESSAGES.ja;
  const en = MESSAGES.en;
  const bytes = (id) => {
    const s = C.SAMPLES.find((x) => x.id === id);
    return [C.parseInput(s.a, s.format).bytes, C.parseInput(s.b, s.format).bytes];
  };
  const diffs = (id) => C.byteDiff(...bytes(id)).positions;
  assert.match(ja['sample.md5-wang2004'], /128バイト/);
  assert.match(ja['note.md5-wang2004'], /6バイトだけ/);
  assert.equal(diffs('md5-wang2004').length, 6);
  assert.match(ja['sample.md5-stevens2012'], /64バイト/);
  assert.equal(diffs('md5-stevens2012').length, 2);
  assert.match(ja['note.md5-textcoll'], /22文字目のAとE/);
  assert.match(en['note.md5-textcoll'], /22nd character/);
  assert.deepEqual(diffs('md5-textcoll'), [21]);
  const [ta, tb] = bytes('md5-textcoll');
  assert.deepEqual([String.fromCharCode(ta[21]), String.fromCharCode(tb[21])], ['A', 'E']);
  // 128文字の組も22文字目だけが違い、2ブロック目のあとで内部状態がそろう（後ろに足しても保たれる）
  assert.deepEqual(diffs('md5-textcoll128'), [21]);
  assert.match(ja['note.md5-textcoll128'], /22文字目のAとEだけ.*2ブロック目のあとで内部状態がそろう/);
  assert.match(en['note.md5-textcoll128'], /22nd character.*after the second block/);
  const [ua, ub] = bytes('md5-textcoll128');
  assert.deepEqual([C.chainCompare('MD5', ua, ub).converge, C.chainCompare('MD5', ...bytes('md5-textcoll')).converge], [2, 0]);
  assert.match(ja['note.sha1-shattered'], /192バイトまでは同じ.*62バイト/);
  assert.equal(diffs('sha1-shattered')[0], 192);
  assert.equal(diffs('sha1-shattered').length, 62);
  // SHAttered の計算量は約2^63回（約922京回）。9京ではない
  for (const k of ['note.sha1-shattered', 'gl.shattered.desc']) {
    assert.match(ja[k], /約2\^63回（約922京回）/);
    assert.doesNotMatch(ja[k], /(?<!2)9京/);
    assert.match(en[k], /2\^63 SHA-1 computations \(about 9\.2 quintillion\)/);
  }
  assert.equal(2 ** 63, 9223372036854775808);
  assert.match(ja['gl.toy.desc'], /平均2ビット/);
  assert.match(ja['hint.byte'], /日本語の1文字は3バイト/);
  assert.equal(C.utf8('日').length, 3);
  assert.match(ja['gl.birthday.desc'], /√\(π\/2\)・2\^\(n\/2\)回（約1\.25×2\^\(n\/2\)回）/);
  assert.equal(Math.sqrt(Math.PI / 2).toFixed(2), '1.25');
});

test('衝突の組の説明は、事実と食い違う古い文言を使わない', () => {
  for (const lang of ['ja', 'en']) {
    const all = Object.values(MESSAGES[lang]).join('\n');
    assert.doesNotMatch(all, /模擬例|educational demo|数時間〜数日|数百KB|9京|完整性/);
  }
  assert.match(MESSAGES.ja['gl.flame.desc'], /署名対象を同じMD5にしました/);
  assert.match(MESSAGES.ja['gl.wang.desc'], /標準の初期値のまま/);
});

test('t は {name} を置き換え、ない鍵はキーをそのまま返す', () => {
  assert.equal(t('ava.diffCount', { d: 126, n: 256, pct: '49.22' }, 'ja'), '違うビット：126 / 256（49.22%）');
  assert.equal(t('ava.diffCount', { d: 126, n: 256, pct: '49.22' }, 'en'), 'Bits that differ: 126 / 256 (49.22%)');
  assert.equal(t('no.such.key', {}, 'ja'), 'no.such.key');
});
