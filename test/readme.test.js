import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { read, core } from './load.js';

const C = core();
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const html = read('index.html');

const DOCS = {
  ja: {
    file: 'README.md', switcher: '[English](README.en.md) · 日本語', day: '**Day056 - 生成AIで作るセキュリティツール100**',
    h1: '# HashViz - 教育用ハッシュ関数ビジュアライザー', shots: /^assets\/screenshot\d*\.png$/,
    h2: ['🌐 デモページ', '📸 スクリーンショット', '✨ 機能', '📖 使い方', '🌊 アバランシェ効果', '🌀 拡散の測定', '💥 衝突の組', '🎂 誕生日攻撃', '🖼️ 指紋の絵', '🔍 可視化のしくみ', '🎮 ToyHash16',
      '🎓 学習の進め方', '🎯 ユースケース', '🔬 技術的な説明', '🔒 セキュリティ', '⚠️ 注意と限界', '📝 開発経緯と実装メモ', '🧪 テスト', '🔗 参考',
      '📁 ディレクトリー構造', '💻 動作環境', '📄 ライセンス', '🛠️ このツールについて'],
    head: { theory: '| アルゴリズム | 出力のビット数 | 平均 | 標準偏差 | 約95%の範囲 |', example: '| アルゴリズム | 元の入力のダイジェスト | 変わったビット |',
      pairs: '| 組 | アルゴリズム | 長さ | 違うバイト | 同じになるダイジェスト | 出典 |', grid: '| アルゴリズム | ビット数 | 2Dのマス目（列×行） |',
      extend: '| 組 | 内部状態がそろうブロック | 後ろに足す | 前に足す |', birthday: '| 比べるビット数 | 16進の桁数 | 最初の衝突までの期待値 | 2^n |',
      limits: '| アルゴリズム | ビット数 | 誕生日攻撃の目安 | 知られている衝突攻撃 |' },
    keep: ['保たれる', '崩れる'], padding: (j) => `${j}（パディングを含む最後のブロック）`, noChain: 'なし（和の計算）', pow: (e) => `約2^${e}`, attackNone: '見つかっていない',
    range: (lo, hi) => `${lo}〜${hi}`, len: (a, b) => (a === b ? `${a}バイト` : `${a}バイトと${b}バイト`), glossary: (n) => `の${n}項目`,
    toy: '`045c`から`0458`', project: 'https://akademeia.info/?page_id=42163',
    // 長音のない表記・「わかる」の漢字書き（分ける・分かれるは漢字のまま）・事実と食い違う古い記述・使っていないライブラリー
    forbidden: new RegExp(['ブラウザ(?!ー)', 'フォルダ(?!ー)', 'ディレクトリ(?!ー)', 'リポジトリ(?!ー)', 'ライブラリ(?!ー)', 'エディタ(?!ー)',
      'サーバ(?!ー)', 'ユーザ(?!ー)', '(?<![自0-9０-９])分か(?!れ)', '全て', '既に', '模擬例', '9京', '数百KB', 'OrbitControls', '完整性', '商用利用',
      'shattered\\.io', 'Three\\.js', 'js-md5'].join('|'))
  },
  en: {
    file: 'README.en.md', switcher: 'English · [日本語](README.md)', day: '**Day056 - 100 Security Tools with Generative AI**',
    h1: '# HashViz - Educational Hash Function Visualizer', shots: /^assets\/en\/screenshot\d*\.png$/,
    h2: ['🌐 Demo', '📸 Screenshots', '✨ Features', '📖 How to use', '🌊 Avalanche effect', '🌀 Diffusion', '💥 Collision pairs', '🎂 Birthday attack',
      '🖼️ Fingerprint art',
      '🔍 How the visualization works',
      '🎮 ToyHash16', '🎓 Learning path', '🎯 Use cases', '🔬 Technical notes', '🔒 Security', '⚠️ Notes and limitations', '📝 Development notes',
      '🧪 Tests', '🔗 References', '📁 Directory structure', '💻 Requirements', '📄 License', '🛠️ About this tool'],
    head: { theory: '| Algorithm | Output bits | Mean | Standard deviation | About 95% |',
      example: '| Algorithm | Digest of the original input | Changed bits |',
      pairs: '| Pair | Algorithm | Length | Differing bytes | Shared digest | Source |', grid: '| Algorithm | Bits | 2D grid (columns × rows) |',
      extend: '| Pair | Block where the internal states agree | Appended after | Added before |',
      birthday: '| Bits compared | Hex digits | Expected tries until the first collision | 2^n |',
      limits: '| Algorithm | Bits | Birthday attack | Known collision attack |' },
    keep: ['Survives', 'Breaks'], padding: (j) => `${j} (the last block, with padding)`, noChain: 'none (a sum)',
    pow: (e) => `about 2^${e}`, attackNone: 'none found',
    range: (lo, hi) => `${lo}-${hi}`, len: (a, b) => (a === b ? `${a} bytes` : `${a} bytes and ${b} byte`),
    glossary: (n) => `${n} entries`,
    toy: 'from `045c` into `0458`', project: 'https://akademeia.info/?page_id=42163',
    forbidden: /educational demo|9 quadrillion|OrbitControls|shattered\.io|Three\.js|js-md5|commercial use/i
  }
};
for (const d of Object.values(DOCS)) d.text = read(d.file);

// H2 の節を、見出しの先頭の絵文字で探す
const sec = (d, emoji) => d.h2.find((x) => x.startsWith(emoji));
const noCode = (md) => md.replace(/```[\s\S]*?```/g, '');
const headings = (md) => noCode(md).split('\n').filter((l) => /^#{1,4} /.test(l));
const h2 = (md) => headings(md).filter((l) => l.startsWith('## ')).map((l) => l.slice(3));

function section(text, heading) {
  const i = text.indexOf(`\n## ${heading}\n`);
  assert.ok(i >= 0, heading);
  const rest = text.slice(i + 1);
  const end = rest.indexOf('\n## ', 3);
  return end < 0 ? rest : rest.slice(0, end);
}

function table(text, firstHeader) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.startsWith(firstHeader));
  assert.ok(start >= 0, firstHeader);
  const rows = [];
  for (let i = start + 2; i < lines.length && lines[i].startsWith('|'); i++) rows.push(lines[i].replace(/^\| | \|$/g, '').split(' | ').map((c) => c.trim()));
  return rows;
}
const unquote = (s) => s.replace(/^`|`$/g, '');

test('YAML メタデータの構造（キーの順、ブロック形式のリスト、固定の値）。YAML は README.md だけに置く', () => {
  const m = DOCS.ja.text.match(/^<!--\n---\n([\s\S]*?)\n---\n-->\n/);
  assert.ok(m, 'YAML block');
  const keys = [...m[1].matchAll(/^([a-z_]+):/gm)].map((x) => x[1]);
  assert.deepEqual(keys, ['id', 'slug', 'title', 'subtitle_ja', 'subtitle_en', 'description_ja', 'description_en', 'category_ja', 'category_en',
    'difficulty', 'tags', 'repo_url', 'demo_url', 'hub']);
  for (const k of ['category_ja', 'category_en', 'tags']) assert.match(m[1], new RegExp(`^${k}:\\n  - `, 'm'), k);
  assert.match(m[1], /^id: day056$/m);
  assert.match(m[1], /^slug: hashviz$/m);
  assert.match(m[1], /^repo_url: "https:\/\/github.com\/ipusiron\/hashviz"$/m);
  assert.match(m[1], /^demo_url: "https:\/\/ipusiron.github.io\/hashviz\/"$/m);
  assert.match(m[1], /^hub: true$/m);
  assert.doesNotMatch(DOCS.en.text, /^<!--\n---/);
});

test('冒頭の形（言語の切り替え・H1・バッジ5種・Dayの行）と、H2の並び。日英で見出しの数と階層がそろう', () => {
  for (const d of Object.values(DOCS)) {
    assert.ok(d.text.includes(`\n${d.switcher}\n`) || d.text.startsWith(`${d.switcher}\n`), d.file);
    assert.ok(d.text.includes(`\n${d.h1}\n`), d.file);
    assert.ok(d.text.includes(`\n${d.day}\n`), d.file);
    for (const b of ['stars', 'forks', 'last-commit', 'license', 'GitHub%20Pages']) assert.ok(d.text.includes(b), `${d.file} ${b}`);
    assert.deepEqual(h2(d.text), d.h2, d.file);
    assert.ok(d.text.includes(`🔗 [${d.project}](${d.project})`), d.file);
  }
  const level = (md) => headings(md).map((l) => l.match(/^#+/)[0].length);
  assert.deepEqual(level(DOCS.en.text), level(DOCS.ja.text));
  assert.ok(headings(DOCS.ja.text).length >= 40);
});

test('画像: README から参照する画像はすべて実在し300KB以下。assets の PNG は README から参照されているものだけ', () => {
  for (const d of Object.values(DOCS)) {
    const refs = [...d.text.matchAll(/!\[[^\]]*\]\((assets\/[^)]+)\)/g)].map((m) => m[1]);
    assert.equal(refs.length, 11, d.file);
    for (const r of refs) {
      assert.match(r, d.shots, r);
      const st = fs.statSync(path.join(ROOT, r));
      assert.ok(st.size <= 300 * 1024, `${r} ${st.size}`);
    }
    const dir = d.file === 'README.md' ? 'assets' : 'assets/en';
    const pngs = fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith('.png')).map((f) => `${dir}/${f}`).sort();
    assert.deepEqual(pngs, [...refs].sort(), dir);
  }
});

test('アバランシェの理論の表は、計算部の二項分布の範囲と同じ', () => {
  for (const d of Object.values(DOCS)) {
    const rows = table(section(d.text, sec(d, '🌊')), d.head.theory);
    assert.deepEqual(rows.map((r) => r[0]), C.ALGOS, d.file);
    for (const [algo, n, mean, sd, range] of rows) {
      const r = C.binomialRange(C.BITS[algo]);
      assert.deepEqual([Number(n), Number(mean), sd, range], [C.BITS[algo], r.mean, r.sd.toFixed(2), d.range(r.lo, r.hi)], `${d.file} ${algo}`);
    }
  }
});

test('hello world の例は、計算部のダイジェストと、0バイト目の0ビット目を反転したときの違うビット数と同じ', async () => {
  const src = C.utf8('hello world');
  const flipped = C.flipBit(src, 0, 0).bytes;
  assert.equal(C.decodeUtf8(flipped), 'iello world');
  for (const d of Object.values(DOCS)) {
    const rows = table(section(d.text, sec(d, '🌊')), d.head.example);
    assert.deepEqual(rows.map((r) => r[0]), ['MD5', 'SHA-1', 'SHA-256', 'ToyHash16'], d.file);
    for (const [algo, hex, changed] of rows) {
      const a = await C.digest(algo, src);
      const b = await C.digest(algo, flipped);
      assert.equal(unquote(hex), C.toHex(a), `${d.file} ${algo}`);
      assert.equal(changed, `${C.diffBits(a, b).count} / ${C.BITS[algo]}`, `${d.file} ${algo}`);
    }
  }
});

test('衝突の組の表は、計算部の組（並び・アルゴリズム・長さ・違うバイト数・同じになるダイジェスト）と同じ', async () => {
  for (const d of Object.values(DOCS)) {
    const rows = table(section(d.text, sec(d, '💥')), d.head.pairs);
    assert.equal(rows.length, C.SAMPLES.length, d.file);
    for (const [k, s] of C.SAMPLES.entries()) {
      const [, algo, len, diffs, digest] = rows[k];
      const a = C.parseInput(s.a, s.format).bytes;
      const b = C.parseInput(s.b, s.format).bytes;
      assert.equal(algo, s.algo, `${d.file} ${s.id}`);
      assert.equal(len, d.len(a.length, b.length), `${d.file} ${s.id}`);
      assert.equal(Number(diffs), C.byteDiff(a, b).positions.length, `${d.file} ${s.id}`);
      assert.equal(unquote(digest), C.toHex(await C.digest(s.algo, a)), `${d.file} ${s.id}`);
      assert.equal(unquote(digest), C.toHex(await C.digest(s.algo, b)), `${d.file} ${s.id}`);
    }
  }
});

test('マス目と3Dの形の表は、計算部の gridShape・voxelShape と同じ。ToyHash16 の例と用語集の項目数も合う', async () => {
  for (const d of Object.values(DOCS)) {
    const rows = table(section(d.text, sec(d, '🔍')), d.head.grid);
    assert.deepEqual(rows.map((r) => r[0]), C.ALGOS, d.file);
    for (const [algo, n, g2, g3] of rows) {
      const g = C.gridShape(C.BITS[algo]);
      const v = C.voxelShape(C.BITS[algo]);
      assert.deepEqual([Number(n), g2, g3], [C.BITS[algo], `${g.cols}×${g.rows}`, `${v.cols}×${v.rows}×${v.layers}`], `${d.file} ${algo}`);
    }
    assert.ok(d.text.includes(d.toy), d.file);
    const dt = (html.match(/<dt data-i18n="gl\./g) || []).length;
    assert.equal(dt, 19);
    assert.ok(d.text.includes(d.glossary(dt)), d.file);
  }
  const src = C.utf8('hello world');
  assert.deepEqual([C.toHex(await C.digest('ToyHash16', src)), C.toHex(await C.digest('ToyHash16', C.flipBit(src, 3, 2).bytes))], ['045c', '0458']);
});

// リポジトリーのファイル（.git・.claude・node_modules を除く）
function files(dir = '') {
  const out = [];
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    if (['.git', '.claude', 'node_modules'].includes(e.name)) continue;
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(`${rel}/`, ...files(rel));
    else out.push(rel);
  }
  return out;
}

test('ディレクトリー構造: すべてのファイルとディレクトリーが載り、全行に説明があり、# の桁がそろう', () => {
  const all = files();
  for (const d of Object.values(DOCS)) {
    const tree = d.text.match(/```text\nhashviz\/\n([\s\S]*?)```/)[1].split('\n').filter(Boolean);
    const cols = new Set();
    const listed = [];
    const stack = [];
    for (const line of tree) {
      const m = line.match(/^((?:│ {3}| {4})*)[├└]── (\S+)\s+# \S/);
      assert.ok(m, `${d.file}: ${line}`);
      cols.add([...line].indexOf('#'));
      const depth = [...m[1]].length / 4;
      stack.length = depth;
      stack.push(m[2]);
      listed.push(stack.join(''));
    }
    assert.equal(cols.size, 1, d.file);
    assert.deepEqual([...listed].sort(), [...all].sort(), d.file);
  }
});

test('表記: 禁止語がない。強調は1節に2カ所まで、箇条書きの先頭を太字にしない', () => {
  for (const d of Object.values(DOCS)) {
    const body = noCode(d.text);
    assert.doesNotMatch(body, d.forbidden, d.file);
    for (const h of d.h2) {
      const n = (section(body, h).match(/\*\*/g) || []).length / 2;
      assert.ok(n <= 2, `${d.file} ${h}: ${n}`);
    }
    assert.doesNotMatch(body, /^\s*- \*\*/m, d.file);
  }
  // 日本語と英数字のあいだに半角空白を入れない（ライセンスの定型文を除く）
  const J = '[\\u3040-\\u30ff\\u3400-\\u9fff\\uff00-\\uffef]';
  const bad = new RegExp(`${J} [A-Za-z0-9(\`]|[A-Za-z0-9)\`] ${J}`);
  for (const line of noCode(DOCS.ja.text).split('\n')) {
    if (line.startsWith('MIT License - ')) continue;
    assert.doesNotMatch(line, bad, line);
  }
});

test('同じデータを足したときの表は、計算部の内部状態の比べ方と、実際に足して計算した結果と同じ', async () => {
  const hello = C.utf8('hello');
  for (const d of Object.values(DOCS)) {
    const rows = table(section(d.text, sec(d, '💥')), d.head.extend);
    assert.equal(rows.length, C.SAMPLES.length, d.file);
    for (const [k, s] of C.SAMPLES.entries()) {
      const [, block, after, before] = rows[k];
      const a = C.parseInput(s.a, s.format).bytes;
      const b = C.parseInput(s.b, s.format).bytes;
      if (C.CHAIN_ALGOS.includes(s.algo)) {
        const r = C.chainCompare(s.algo, a, b);
        assert.equal(block, r.suffixSafe ? String(r.converge) : d.padding(r.blocks), `${d.file} ${s.id}`);
      } else {
        assert.equal(block, d.noChain, `${d.file} ${s.id}`);
      }
      const same = async (x, y) => C.toHex(await C.digest(s.algo, x)) === C.toHex(await C.digest(s.algo, y));
      const [sa, sb] = C.extendPair(a, b, hello, 'suffix');
      const [pa, pb] = C.extendPair(a, b, hello, 'prefix');
      assert.deepEqual([after, before], [d.keep[(await same(sa, sb)) ? 0 : 1], d.keep[(await same(pa, pb)) ? 0 : 1]], `${d.file} ${s.id}`);
    }
  }
});

test('誕生日攻撃の表は、計算部の期待値と、アルゴリズム全体の目安（BIRTHDAY_LIMITS）と同じ', () => {
  for (const d of Object.values(DOCS)) {
    const bsec = section(d.text, sec(d, '🎂'));
    const rows = table(bsec, d.head.birthday);
    assert.deepEqual(rows.map((r) => Number(r[0])), [8, 16, 24, 32, 36], d.file);
    for (const [n, hex, expected, all] of rows) {
      assert.equal(Number(hex), Number(n) / 4, `${d.file} ${n}`);
      assert.equal(expected, Math.round(C.birthdayExpected(Number(n))).toLocaleString('en-US'), `${d.file} ${n}`);
      assert.equal(all, (2 ** Number(n)).toLocaleString('en-US'), `${d.file} ${n}`);
    }
    const limits = table(bsec, d.head.limits);
    assert.deepEqual(limits.map((r) => r[0]), C.BIRTHDAY_LIMITS.map((x) => x.algo), d.file);
    for (const [k, x] of C.BIRTHDAY_LIMITS.entries()) {
      const [, bits, birthday, attack] = limits[k];
      assert.deepEqual([Number(bits), birthday], [x.bits, d.pow(x.birthday)], `${d.file} ${x.algo}`);
      if (x.attack === null) assert.equal(attack, d.attackNone, `${d.file} ${x.algo}`);
      else assert.ok(attack.startsWith(d.pow(x.attack)), `${d.file} ${x.algo}`);
    }
    // 計算部の選べるビット数の上限と、本文の「36ビットまで」がそろう
    assert.equal(Math.max(...C.BIRTHDAY_BITS), 36);
    assert.ok(d.text.includes(d.file === 'README.md' ? '36ビットまで' : 'up to 36'), d.file);
  }
});

test('拡散の測定の表は、種を7に固定した乱数で入力100個を測った計算部の結果と同じ', async () => {
  const name = { ja: (r) => `SHA-256（${r}ラウンド）`, en: (r) => `SHA-256 (${r} round${r === 1 ? '' : 's'})` };
  const head = { ja: '| アルゴリズム | 違うビット数の平均 |', en: '| Algorithm | Mean differing bits |' };
  const cases = [['MD5', 64], ['SHA-1', 64], ['SHA-256', 64], ['SHA-512', 64], ['ToyHash16', 64], ['SHA-256-R', 1], ['SHA-256-R', 2], ['SHA-256-R', 4],
    ['SHA-256-R', 8]];
  const want = [];
  for (const [algo, rounds] of cases) {
    const s = C.diffusionSummary(await C.diffusionExperiment({ algo, rounds, inputs: 100, randomBytes: C.seededBytes(7) }));
    want.push([algo, rounds, s.mean.toFixed(2), `${(s.within * 100).toFixed(1)}%`, s.sacMeanDev.toFixed(4),
      `${s.zeroCells.toLocaleString('en-US')} / ${s.cells.toLocaleString('en-US')}`]);
  }
  for (const [lang, d] of Object.entries(DOCS)) {
    const rows = table(section(d.text, sec(d, '🌀')), head[lang]);
    assert.equal(rows.length, want.length, d.file);
    rows.forEach((row, k) => {
      const [algo, rounds, ...values] = want[k];
      assert.equal(row[0], algo === 'SHA-256-R' ? name[lang](rounds) : algo, `${d.file} ${k}`);
      assert.deepEqual(row.slice(1), values, `${d.file} ${row[0]}`);
    });
    // 目安 0.399/√T（T=100）
    assert.equal((0.5 * Math.sqrt(2 / (Math.PI * 100))).toFixed(4), '0.0399');
    assert.ok(section(d.text, sec(d, '🌀')).includes('0.0399'), d.file);
  }
});

test('指紋の絵の節: 図19の11件の指紋は計算部の LOSS_FIG19 と同じ並びで、絵は計算部で描いたものと同じ', () => {
  for (const d of Object.values(DOCS)) {
    const body = section(d.text, sec(d, '🖼️'));
    const blocks = [...body.matchAll(/```text\n([\s\S]*?)\n```/g)].map((m) => m[1]);
    assert.equal(blocks.length, 2, d.file);
    assert.deepEqual(blocks[0].split('\n'), C.LOSS_FIG19, d.file);
    assert.equal(blocks[1], C.randomartText(C.parseFingerprint(C.LOSS_FIG19[0]).bytes), d.file);
    for (const f of C.LOSS_FIG19) assert.equal(C.randomartText(C.parseFingerprint(f).bytes), blocks[1], f);
    // Tan らの表の数（一次資料の表3）
    for (const x of ['6%', '10%', '12%', '14%', '17%', '21%', '35%', '54%']) assert.ok(body.includes(`| ${x} |`), `${d.file} ${x}`);
  }
});
