import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { core, seeded } from './load.js';

const C = core();
const nodeHash = (algo, bytes) => crypto.createHash(algo.replace('-', '').toLowerCase()).update(bytes).digest('hex');
const hex = (h) => Uint8Array.from(Buffer.from(h, 'hex'));

test('MD5: RFC 1321 の付録 A.5 のテストスイート7件', () => {
  const suite = [
    ['', 'd41d8cd98f00b204e9800998ecf8427e'],
    ['a', '0cc175b9c0f1b6a831c399e269772661'],
    ['abc', '900150983cd24fb0d6963f7d28e17f72'],
    ['message digest', 'f96b697d7cb7938d525a2f31aaf161d0'],
    ['abcdefghijklmnopqrstuvwxyz', 'c3fcd3d76192e4007dfb496cca67e13b'],
    ['ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 'd174ab98d277d9f5a5611c2c9f419d9f'],
    ['1234567890'.repeat(8), '57edf4a22be3c955ac49da2e2107b67a']
  ];
  for (const [msg, want] of suite) assert.equal(C.toHex(C.md5(C.utf8(msg))), want, msg);
});

test('MD5: 0x80 以上のバイトも Node の crypto と一致する（改修前は文字列化して誤っていた入力を含む）', () => {
  const cases = [C.utf8('café'), C.utf8('こんにちは'), Uint8Array.of(0xe8, 0x65, 0x6c, 0x6c, 0x6f), Uint8Array.from({ length: 256 }, (_, i) => i)];
  assert.equal(C.toHex(C.md5(cases[0])), '07117fe4a1ebd544965dc19573183da2');
  assert.equal(C.toHex(C.md5(cases[1])), 'c0e89a293bd36c7a768e4e9d2c5475a8');
  assert.equal(C.toHex(C.md5(cases[2])), 'b6d25cee6329414577edf52bdbf21668');
  const rand = seeded(56);
  for (const len of [55, 56, 57, 63, 64, 65, 119, 120, 128, 1000]) cases.push(Uint8Array.from({ length: len }, () => rand(256)));
  for (let i = 0; i < 40; i++) cases.push(Uint8Array.from({ length: rand(300) }, () => rand(256)));
  for (const b of cases) assert.equal(C.toHex(C.md5(b)), nodeHash('md5', b), String(b.length));
});

test('MD5 のパディングと内部状態: 長さで伸び方が変わり、最後の状態がダイジェストになる', () => {
  assert.deepEqual([0, 55, 56, 63, 64, 119, 120].map((n) => C.md5Pad(new Uint8Array(n)).length), [64, 64, 128, 128, 128, 128, 192]);
  const p = C.md5Pad(C.utf8('abc'));
  assert.deepEqual([p[3], p[4], p[56], p[57], p[63]], [0x80, 0, 24, 0, 0]);
  const chain = C.md5Chain(C.utf8('abc'));
  assert.equal(chain.length, 2);
  assert.deepEqual(chain[0], [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476]);
  assert.equal(C.toHex(C.md5StateBytes(chain[1])), '900150983cd24fb0d6963f7d28e17f72');
  // Wang の組は、1ブロック目のあとでは状態が違い、2ブロック目のあとでそろう
  const w = C.SAMPLES.find((s) => s.id === 'md5-wang2004');
  const [ca, cb] = [C.md5Chain(hex(w.a)), C.md5Chain(hex(w.b))];
  assert.notDeepEqual(ca[1], cb[1]);
  assert.deepEqual(ca[2], cb[2]);
});

test('SHA-1・SHA-256・SHA-512 は Web Crypto で計算し、Node の crypto と一致する', async () => {
  const rand = seeded(1);
  for (let i = 0; i < 20; i++) {
    const b = Uint8Array.from({ length: rand(200) }, () => rand(256));
    for (const algo of ['MD5', 'SHA-1', 'SHA-256', 'SHA-512']) {
      const d = await C.digest(algo, b);
      assert.equal(C.toHex(d), nodeHash(algo, b), algo);
      assert.equal(d.length * 8, C.BITS[algo]);
    }
  }
  await assert.rejects(C.digest('SHA-3', new Uint8Array(1)), /unknown algorithm/);
});

test('ToyHash16: バイトの和を 65536 で割った余りを、上位・下位の2バイトで返す', async () => {
  assert.equal(C.toHex(C.toyHash16(C.utf8('AB'))), '0083');
  assert.equal(C.toHex(C.toyHash16(new Uint8Array(256).fill(0xff))), 'ff00');
  assert.equal(C.toHex(C.toyHash16(new Uint8Array(258).fill(0xff))), '00fe');
  assert.equal(C.toHex(await C.digest('ToyHash16', new Uint8Array(0))), '0000');
});

test('衝突の組: どれも、狙ったアルゴリズムだけで同じダイジェストになる', async () => {
  const want = {
    'md5-wang2004': ['MD5', [128, 128], '79054025255fb1a26e4bc422aef54eb4'],
    'md5-stevens2012': ['MD5', [64, 64], '008ee33a9d58b51cfeb425b0959121c9'],
    'md5-textcoll': ['MD5', [72, 72], 'faad49866e9498fc1719f5289e7a0269'],
    'md5-textcoll128': ['MD5', [128, 128], '3e11950f78f3e4da98630fb102307c70'],
    'sha1-shattered': ['SHA-1', [320, 320], 'f92d74e3874587aaf443d1db961d4e26dde13e9c'],
    'toy-ab': ['ToyHash16', [2, 1], '0083'],
    'toy-abc': ['ToyHash16', [3, 1], '00c6']
  };
  assert.deepEqual(C.SAMPLES.map((s) => s.id), Object.keys(want));
  for (const s of C.SAMPLES) {
    const [algo, lens, digest] = want[s.id];
    const a = C.parseInput(s.a, s.format);
    const b = C.parseInput(s.b, s.format);
    assert.equal(s.algo, algo);
    assert.deepEqual([a.bytes.length, b.bytes.length], lens, s.id);
    assert.notDeepEqual(a.bytes, b.bytes, s.id);
    const all = await C.compareAll(a.bytes, b.bytes);
    assert.deepEqual(all.filter((x) => x.same).map((x) => x.algo), [algo], s.id);
    assert.equal(C.toHex(all.find((x) => x.algo === algo).a), digest, s.id);
    // ほかのハッシュと一致しないことは Node の crypto でも確かめる
    for (const other of ['MD5', 'SHA-1', 'SHA-256', 'SHA-512'].filter((x) => x !== algo)) {
      assert.notEqual(nodeHash(other, a.bytes), nodeHash(other, b.bytes), `${s.id} ${other}`);
    }
  }
});

test('衝突の組の中身: 違うバイトの位置、文字列の組は ASCII、SHAttered は PDF の先頭。出典は https のリンク', () => {
  const get = (id) => C.SAMPLES.find((s) => s.id === id);
  const bytes = (s) => [C.parseInput(s.a, s.format).bytes, C.parseInput(s.b, s.format).bytes];
  assert.deepEqual(C.byteDiff(...bytes(get('md5-wang2004'))).positions, [19, 45, 59, 83, 109, 123]);
  assert.deepEqual(C.byteDiff(...bytes(get('md5-stevens2012'))).positions, [35, 55]);
  assert.deepEqual(C.byteDiff(...bytes(get('md5-textcoll'))).positions, [21]);
  assert.deepEqual(C.byteDiff(...bytes(get('md5-textcoll128'))).positions, [21]);
  assert.match(get('md5-textcoll128').a, /^[!-~]{128}$/);
  // 128文字の組は72文字の組と同じ先頭21文字
  assert.equal(get('md5-textcoll128').a.slice(0, 21), get('md5-textcoll').a.slice(0, 21));
  assert.match(get('md5-textcoll').a, /^[\x21-\x7e]{72}$/);
  const [s1, s2] = bytes(get('sha1-shattered'));
  assert.equal(Buffer.from(s1.slice(0, 8)).toString('latin1'), '%PDF-1.3');
  assert.deepEqual(s1.slice(0, 192), s2.slice(0, 192));
  for (const s of C.SAMPLES) {
    assert.equal(s.sources.length > 0, s.algo !== 'ToyHash16', s.id);
    for (const src of s.sources) assert.match(src.url, /^https:\/\/[^\s'"<>]+$/, s.id);
  }
});

test('16進の読み取り: 空白と 0x を許し、奇数桁・16進でない文字は理由を返す', () => {
  assert.deepEqual(C.parseHex(' 0x41 42\n4A ').bytes, Uint8Array.of(0x41, 0x42, 0x4a));
  assert.deepEqual(C.parseHex('').bytes, new Uint8Array(0));
  assert.deepEqual(C.parseHex('abc'), { ok: false, error: 'hex-odd', digits: 3 });
  assert.deepEqual(C.parseHex('41zz'), { ok: false, error: 'hex-char', char: 'z' });
  assert.deepEqual(C.parseHex('41😀'), { ok: false, error: 'hex-char', char: '😀' });
  assert.deepEqual(C.parseHex('0x0x41'), { ok: false, error: 'hex-char', char: 'x' });
});

test('Base64 の読み取り: 標準と URL 用、= の省略を許し、長さと文字の誤りを返す', () => {
  const rand = seeded(7);
  for (let i = 0; i < 30; i++) {
    const b = Buffer.from(Uint8Array.from({ length: rand(40) }, () => rand(256)));
    assert.deepEqual(Buffer.from(C.parseBase64(b.toString('base64')).bytes), b);
    assert.deepEqual(Buffer.from(C.parseBase64(b.toString('base64url')).bytes), b);
  }
  assert.deepEqual(C.parseBase64('QUI').bytes, Uint8Array.of(0x41, 0x42));
  assert.deepEqual(C.parseBase64('QU I=\n').bytes, Uint8Array.of(0x41, 0x42));
  assert.deepEqual(C.parseBase64('QUJDR'), { ok: false, error: 'b64-length' });
  assert.deepEqual(C.parseBase64('QUI=='), { ok: false, error: 'b64-length' });
  assert.deepEqual(C.parseBase64('QU*I'), { ok: false, error: 'b64-char', char: '*' });
  assert.deepEqual(C.parseBase64('Q=UI'), { ok: false, error: 'b64-char', char: '=' });
});

test('入力の形式: 文字列は UTF-8、上限を超えると too-long、知らない形式は例外', () => {
  assert.deepEqual(C.parseInput('é', 'text').bytes, Uint8Array.of(0xc3, 0xa9));
  assert.deepEqual(C.parseInput('00'.repeat(C.MAX_BYTES + 1), 'hex'), { ok: false, error: 'too-long', bytes: C.MAX_BYTES + 1, max: C.MAX_BYTES });
  assert.equal(C.parseInput('00'.repeat(C.MAX_BYTES), 'hex').ok, true);
  assert.throws(() => C.parseInput('x', 'binary'), /unknown format/);
  assert.deepEqual(C.FORMATS, ['text', 'hex', 'base64']);
});

test('ビットの並び: 各バイトの上位から。違うビットの数と、違うバイトの位置', () => {
  assert.deepEqual([...C.bytesToBits(Uint8Array.of(0x80, 0x01))], [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
  const d = C.diffBits(Uint8Array.of(0xf0, 0x00), Uint8Array.of(0x0f, 0x01));
  assert.equal(d.count, 9);
  assert.deepEqual([...d.bits.slice(8)], [0, 0, 0, 0, 0, 0, 0, 1]);
  assert.throws(() => C.diffBits(new Uint8Array(1), new Uint8Array(2)), /length mismatch/);
  assert.deepEqual(C.byteDiff(Uint8Array.of(1, 2, 3), Uint8Array.of(1, 9)), { positions: [1, 2], lengthA: 3, lengthB: 2 });
  assert.equal(C.formatHex(Uint8Array.from({ length: 20 }, (_, i) => i)),
    '00010203 04050607 08090a0b 0c0d0e0f\n10111213');
  assert.equal(C.toBinary(5), '00000101');
});

test('1ビットの反転: 範囲外は丸めずに理由を返し、元のバイト列は変えない', () => {
  const src = C.utf8('hello');
  const r = C.flipBit(src, 0, 7);
  assert.deepEqual([r.ok, r.before, r.after, r.bytes[0], src[0]], [true, 0x68, 0xe8, 0xe8, 0x68]);
  assert.deepEqual(C.flipBit(src, 5, 0), { ok: false, error: 'byte-range', max: 4 });
  assert.deepEqual(C.flipBit(src, 0, 8), { ok: false, error: 'bit-range' });
  assert.deepEqual(C.flipBit(src, 0, NaN), { ok: false, error: 'bit-range' });
  assert.deepEqual(C.flipBit(new Uint8Array(0), 0, 0), { ok: false, error: 'empty' });
  assert.deepEqual(['3', ' 12 ', '', '1.5', '1e2', '-1', '٣'].map(C.parseIndex), [3, 12, NaN, NaN, NaN, NaN, NaN]);
});

test('バイトの持ち主: UTF-8 で何文字目の何バイト目か。反転後に UTF-8 として読めるか', () => {
  const text = 'aé日😀';
  const own = [0, 1, 2, 3, 5, 6, 9].map((i) => C.byteOwner(text, i)).map((o) => o && [o.char, o.cp, o.index, o.byteInChar, o.charBytes]);
  assert.deepEqual(own, [
    ['a', 'U+0061', 0, 1, 1], ['é', 'U+00E9', 1, 1, 2], ['é', 'U+00E9', 1, 2, 2], ['日', 'U+65E5', 2, 1, 3],
    ['日', 'U+65E5', 2, 3, 3], ['😀', 'U+1F600', 3, 1, 4], ['😀', 'U+1F600', 3, 4, 4]
  ]);
  assert.equal(C.byteOwner(text, 10), null);
  assert.equal(C.decodeUtf8(C.flipBit(C.utf8('hello'), 0, 0).bytes), 'iello');
  assert.equal(C.decodeUtf8(C.flipBit(C.utf8('hello'), 0, 7).bytes), null);
});

test('アバランシェの理論値: B(n, 1/2) の中央95%の範囲は、BigInt の厳密な計算と一致する', () => {
  const exactLo = (n) => {
    const total = 2n ** BigInt(n);
    let c = 1n;
    let cdf = 0n;
    for (let k = 0; k <= n; k++) {
      cdf += c;
      if (cdf * 40n > total) return k;
      c = (c * BigInt(n - k)) / BigInt(k + 1);
    }
    return n;
  };
  for (const n of [16, 128, 160, 256, 512]) {
    const r = C.binomialRange(n);
    assert.deepEqual([r.lo, r.hi, r.mean], [exactLo(n), n - exactLo(n), n / 2], String(n));
    assert.equal(r.sd, Math.sqrt(n) / 2);
  }
  assert.deepEqual([C.binomialRange(128).lo, C.binomialRange(128).hi, C.binomialRange(256).lo, C.binomialRange(256).hi], [53, 75, 112, 144]);
  assert.deepEqual([C.avalancheVerdict(2, 16), C.avalancheVerdict(128, 256), C.avalancheVerdict(145, 256)], ['low', 'within', 'high']);
});

test('ダイジェストの統計: 1の数・連続（runs）・最長の連続・0と1の偏り（エントロピー）・異なるバイト値の数', () => {
  const s = C.digestStats(Uint8Array.of(0xff, 0x00));
  assert.deepEqual([s.bits, s.ones, s.zeros, s.runs, s.maxRun, s.entropy, s.bytes, s.uniqueBytes], [16, 8, 8, 2, 8, 1, 2, 2]);
  const t = C.digestStats(Uint8Array.of(0xaa));
  assert.deepEqual([t.runs, t.maxRun, t.onesRatio], [8, 1, 0.5]);
  assert.equal(C.digestStats(Uint8Array.of(0xff)).entropy, 0);
});

test('グリッドと3Dの形: 各アルゴリズムのビット数をちょうど埋める', () => {
  const want = { MD5: [16, 8, 8, 4, 4], 'SHA-1': [20, 8, 8, 5, 4], 'SHA-256': [16, 16, 8, 8, 4], 'SHA-512': [32, 16, 8, 8, 8], ToyHash16: [4, 4, 4, 2, 2] };
  for (const algo of C.ALGOS) {
    const n = C.BITS[algo];
    const g = C.gridShape(n);
    const v = C.voxelShape(n);
    assert.deepEqual([g.cols, g.rows, v.cols, v.rows, v.layers], want[algo], algo);
    assert.equal(g.cols * g.rows, n);
    assert.equal(v.cols * v.rows * v.layers, n);
  }
  for (const n of [1, 7, 100, 1000]) {
    const g = C.gridShape(n);
    const v = C.voxelShape(n);
    assert.ok(g.cols * g.rows >= n && v.cols * v.rows * v.layers >= n, String(n));
  }
});

test('3Dの配置: ビット0は左上の手前、最後のビットは右下の奥。全体の中心が原点', () => {
  const shape = C.voxelShape(256);
  assert.deepEqual(C.voxelCenter(0, shape), [-3.5, 3.5, 1.5]);
  assert.deepEqual(C.voxelCenter(1, shape), [-2.5, 3.5, 1.5]);
  assert.deepEqual(C.voxelCenter(8, shape), [-3.5, 2.5, 1.5]);
  assert.deepEqual(C.voxelCenter(64, shape), [-3.5, 3.5, 0.5]);
  assert.deepEqual(C.voxelCenter(255, shape), [3.5, -3.5, -1.5]);
  const sum = [0, 0, 0];
  for (let i = 0; i < 256; i++) C.voxelCenter(i, shape).forEach((x, k) => { sum[k] += x; });
  assert.deepEqual(sum, [0, 0, 0]);
  const r = C.rotate([1, 0, 0], Math.PI / 2, 0);
  assert.ok(Math.abs(r[0]) < 1e-12 && Math.abs(r[2] + 1) < 1e-12);
});

test('3Dの絵: 正面からは手前の面だけ、斜めからは3面。奥から順に並び、画面の中に収まる', () => {
  const rand = seeded(3);
  const bits = Uint8Array.from({ length: 128 }, () => rand(2));
  const front = C.scene3d(bits, { width: 400, height: 400 });
  assert.equal(front.length, 128);
  assert.equal(front[0].index >= 96, true);
  assert.equal(front[front.length - 1].index < 32, true);
  // ビット0（左上の手前）は画面の左上に描く
  const p0 = front.find((p) => p.index === 0).pts;
  assert.ok(p0.every(([x, y]) => x < 200 && y < 200));
  const view = { width: 400, height: 300, yaw: 0.6, pitch: 0.4, marks: new Set([5]) };
  const tilted = C.scene3d(bits, view);
  assert.equal(tilted.length, 128 * 3);
  assert.ok(tilted.every((p) => p.pts.length === 4 && p.pts.every(([x, y]) => x >= 0 && x <= 400 && y >= 0 && y <= 300)));
  assert.ok(tilted.every((p) => p.shade >= 0.55 && p.shade <= 1));
  assert.deepEqual([...new Set(tilted.filter((p) => p.mark).map((p) => p.index))], [5]);
  // 0 のビットは小さい立方体で描く（中まで見通せる）
  const area = (pts) => Math.abs(pts.reduce((s, [x, y], i) => { const [u, v] = pts[(i + 1) % 4]; return s + x * v - u * y; }, 0)) / 2;
  const one = front.find((p) => p.bit === 1);
  const zero = front.find((p) => p.bit === 0);
  assert.ok(area(zero.pts) < area(one.pts) / 4);
  // 奥のものほど先に塗る
  const z = (i) => C.rotate(C.voxelCenter(i, C.voxelShape(128)), 0.6, 0.4)[2];
  for (let k = 1; k < tilted.length; k++) assert.ok(z(tilted[k - 1].index) <= z(tilted[k].index) + 1e-9);
});

test('2Dのグリッドの当たり判定: 四隅のマスと、外側', () => {
  // SHA-1 は 20×8。幅400・高さ160 のキャンバスなら1マス20
  assert.equal(C.gridCellAt(160, 400, 160, 1, 1), 0);
  assert.equal(C.gridCellAt(160, 400, 160, 399, 1), 19);
  assert.equal(C.gridCellAt(160, 400, 160, 399, 159), 159);
  assert.equal(C.gridCellAt(160, 400, 160, 400, 1), -1);
  // 縦長のキャンバスでは上下に余白ができる
  assert.equal(C.gridCellAt(16, 100, 200, 50, 10), -1);
  assert.equal(C.gridCellAt(16, 100, 200, 1, 51), 0);
});

// ===== 第2弾: SHA-1 の内部状態・接尾辞の実験・誕生日攻撃 =====
test('SHA-1: FIPS 180 の例（abc・空・448ビット・100万の a）と、乱数の入力を Node の crypto と比べる', () => {
  assert.equal(C.toHex(C.sha1(C.utf8('abc'))), 'a9993e364706816aba3e25717850c26c9cd0d89d');
  assert.equal(C.toHex(C.sha1(C.utf8(''))), 'da39a3ee5e6b4b0d3255bfef95601890afd80709');
  assert.equal(C.toHex(C.sha1(C.utf8('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'))), '84983e441c3bd26ebaae4aa1f95129e5e54670f1');
  assert.equal(C.toHex(C.sha1(new Uint8Array(1000000).fill(0x61))), '34aa973cd4c4daa4f61eeb2bdbad27316534016f');
  const rand = seeded(9);
  for (const len of [55, 56, 63, 64, 65, 320, 1000]) {
    const b = Uint8Array.from({ length: len }, () => rand(256));
    assert.equal(C.toHex(C.sha1(b)), nodeHash('SHA-1', b), String(len));
  }
  // 長さはビッグエンディアンで最後の8バイトに入る（MD5 はリトルエンディアン）
  const p = C.sha1Pad(C.utf8('abc'));
  assert.deepEqual([p.length, p[3], p[62], p[63]], [64, 0x80, 0, 24]);
  assert.deepEqual(C.sha1Chain(C.utf8('abc'))[0], [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0]);
});

test('ブロックごとの内部状態: どの組も、そろうブロックと、後ろに足しても保たれるかが Node の crypto の結果と合う', async () => {
  const want = {
    'md5-wang2004': { blocks: 3, converge: 2, pattern: '= xd =d =p' },
    'md5-stevens2012': { blocks: 2, converge: 1, pattern: '= =d =p' },
    'md5-textcoll': { blocks: 2, converge: 0, pattern: '= xd =p' },
    'md5-textcoll128': { blocks: 3, converge: 2, pattern: '= xd = =p' },
    'sha1-shattered': { blocks: 6, converge: 5, pattern: '= = = = xd =d =p' }
  };
  const chained = C.SAMPLES.filter((s) => C.CHAIN_ALGOS.includes(s.algo));
  assert.deepEqual(chained.map((s) => s.id), Object.keys(want));
  for (const s of chained) {
    const a = C.parseInput(s.a, s.format).bytes;
    const b = C.parseInput(s.b, s.format).bytes;
    const r = C.chainCompare(s.algo, a, b);
    const w = want[s.id];
    const pattern = r.rows.map((x) => (x.same ? '=' : 'x') + (x.inputDiffers ? 'd' : '') + (x.padding ? 'p' : '')).join(' ');
    assert.deepEqual([r.blocks, r.converge, r.suffixSafe, r.finalSame, pattern], [w.blocks, w.converge, w.converge > 0, true, w.pattern], s.id);
    // 最後の内部状態はダイジェストそのもの
    assert.equal(r.rows[r.blocks].stateA, nodeHash(s.algo, a), s.id);
    for (const extra of ['hello', '', 'x'.repeat(100)]) {
      const e = C.utf8(extra);
      const [sa, sb] = C.extendPair(a, b, e, 'suffix');
      assert.equal(nodeHash(s.algo, sa) === nodeHash(s.algo, sb), extra === '' || r.suffixSafe, `${s.id} suffix ${extra.length}`);
      const [pa, pb] = C.extendPair(a, b, e, 'prefix');
      assert.equal(nodeHash(s.algo, pa) === nodeHash(s.algo, pb), extra === '', `${s.id} prefix ${extra.length}`);
    }
  }
  assert.equal(C.chainCompare('MD5', C.utf8('a'), C.utf8('b')).finalSame, false);
  assert.equal(C.chainCompare('SHA-1', C.utf8('ab'), C.utf8('abc')).suffixSafe, false);
  assert.throws(() => C.chainCompare('SHA-256', new Uint8Array(1), new Uint8Array(1)), /no chain/);
  assert.throws(() => C.extendPair(new Uint8Array(1), new Uint8Array(1), new Uint8Array(1), 'middle'), /unknown position/);
  assert.deepEqual(C.concatBytes(Uint8Array.of(1), Uint8Array.of(2, 3)), Uint8Array.of(1, 2, 3));
});

test('誕生日攻撃: 先頭 n ビットの読み方、期待値と累積分布、アルゴリズム全体の目安', () => {
  const d = Uint8Array.of(0xab, 0xcd, 0xef, 0x12, 0x34, 0x56, 0x78);
  assert.deepEqual([8, 12, 16, 20, 36, 48].map((n) => C.truncateBits(d, n)), [0xab, 0xabc, 0xabcd, 0xabcde, 0xabcdef123, 0xabcdef123456]);
  assert.throws(() => C.truncateBits(d, 0), /bad bit count/);
  assert.throws(() => C.truncateBits(d, 49), /bad bit count/);
  assert.throws(() => C.truncateBits(Uint8Array.of(1), 12), /bad bit count/);
  assert.ok(Math.abs(C.birthdayExpected(16) - Math.sqrt(Math.PI / 2) * 256) < 1e-9);
  // 期待値の回数で見つかっている確率は約 1 − e^(−π/4) ≈ 0.544
  assert.ok(Math.abs(C.birthdayCdf(C.birthdayExpected(32), 32) - (1 - Math.exp(-Math.PI / 4))) < 1e-4);
  assert.deepEqual([C.birthdayCdf(1, 8), C.birthdayCdf(0, 8)], [0, 0]);
  assert.deepEqual(C.BIRTHDAY_BITS, [8, 12, 16, 20, 24, 28, 32, 36]);
  assert.deepEqual(C.BIRTHDAY_ALGOS, ['MD5', 'SHA-1', 'SHA-256', 'SHA-512']);
  for (const x of C.BIRTHDAY_LIMITS) assert.equal(x.birthday, x.bits / 2, x.algo);
  assert.deepEqual(C.BIRTHDAY_LIMITS.map((x) => [x.algo, x.attack]), [['MD5', 16], ['SHA-1', 63.1], ['SHA-256', null], ['SHA-512', null]]);
  const sum = C.birthdaySummary([3, 1, 2, 10], 8);
  assert.deepEqual([sum.count, sum.mean, sum.median, sum.min, sum.max], [4, 4, 2.5, 1, 10]);
  assert.equal(sum.ratio, 4 / C.birthdayExpected(8));
});

test('誕生日攻撃: 見つかった2つの文は先頭 n ビットだけ一致し、同じ種なら同じ結果。n=8 は257回以内', async () => {
  for (const algo of C.BIRTHDAY_ALGOS) {
    for (const n of [8, 16, 20]) {
      const r = await C.birthdaySearch({ algo, n, seed: `t-${algo}-${n}` });
      assert.notEqual(r.a, r.b);
      assert.equal(r.a, C.birthdayMessage(`t-${algo}-${n}`, r.indexA));
      assert.equal(r.b, C.birthdayMessage(`t-${algo}-${n}`, r.indexB));
      assert.equal(r.tries, r.indexB + 1);
      const [da, db] = [nodeHash(algo, C.utf8(r.a)), nodeHash(algo, C.utf8(r.b))];
      assert.equal(da.slice(0, n / 4), db.slice(0, n / 4), `${algo} ${n}`);
      assert.notEqual(da, db);
      assert.equal(C.truncateBits(Buffer.from(da, 'hex'), n), r.value);
      if (n === 8) assert.ok(r.tries <= 257, String(r.tries));
      const again = await C.birthdaySearch({ algo, n, seed: `t-${algo}-${n}`, batch: 7 });
      assert.deepEqual([again.a, again.b, again.tries], [r.a, r.b, r.tries]);
    }
  }
});

test('誕生日攻撃: n=12 で200回試した平均は、理論の期待値の±10%に入る。止めれば null、途中で回数を知らせる', async () => {
  const tries = [];
  for (let i = 0; i < 200; i++) tries.push((await C.birthdaySearch({ algo: 'MD5', n: 12, seed: `avg${i}` })).tries);
  const s = C.birthdaySummary(tries, 12);
  assert.ok(Math.abs(s.ratio - 1) < 0.1, String(s.ratio));
  const seen = [];
  let calls = 0;
  let pauses = 0;
  const stopped = await C.birthdaySearch({
    algo: 'SHA-256', n: 36, seed: 'stop', batch: 64, onProgress: (k) => seen.push(k), shouldStop: () => ++calls > 3,
    pause: () => {
      pauses += 1;
      return pauses % 2 ? null : new Promise((resolve) => setTimeout(resolve, 0));
    }
  });
  assert.equal(stopped, null);
  assert.deepEqual([seen, pauses], [[64, 128, 192], 3]);
  await assert.rejects(C.birthdaySearch({ algo: 'ToyHash16', n: 8, seed: 'x' }), /unknown algorithm/);
});

// ===== 第3弾: ラウンド数を縮めた SHA-256・拡散の測定 =====
test('ラウンド数を縮めた SHA-256: 64ラウンドは Node の crypto と一致、0ラウンドは初期値の2倍、範囲外は例外', () => {
  const rand = C.seededBytes(11);
  for (const len of [0, 3, 55, 56, 63, 64, 65, 120, 1000]) {
    const b = rand(len);
    assert.equal(C.toHex(C.sha256Rounds(b, 64)), nodeHash('SHA-256', b), String(len));
  }
  const iv = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  assert.equal(C.toHex(C.sha256Rounds(new Uint8Array(0), 0)), iv.map((x) => ((x * 2) >>> 0).toString(16).padStart(8, '0')).join(''));
  assert.throws(() => C.sha256Rounds(new Uint8Array(1), 65), /bad rounds/);
  assert.throws(() => C.sha256Rounds(new Uint8Array(1), 1.5), /bad rounds/);
  assert.notEqual(C.toHex(C.sha256Rounds(C.utf8('abc'), 63)), C.toHex(C.sha256Rounds(C.utf8('abc'), 64)));
  // 種つきの乱数は同じ種なら同じ並び
  assert.deepEqual(C.seededBytes(5)(16), C.seededBytes(5)(16));
  assert.notDeepEqual(C.seededBytes(5)(16), C.seededBytes(6)(16));
});

test('二項分布の確率: 合計が1で、B(16, 1/2) の8は C(16,8)/2^16', () => {
  for (const n of [16, 128, 512]) assert.ok(Math.abs(C.binomialPmf(n).reduce((s, x) => s + x, 0) - 1) < 1e-9, String(n));
  assert.ok(Math.abs(C.binomialPmf(16)[8] - 12870 / 65536) < 1e-12);
});

test('拡散の測定: SHA-256 と MD5 は理想に近く、ToyHash16 と1〜4ラウンドの SHA-256 は偏る（種つきの乱数、各100個の入力）', async () => {
  const run = async (algo, rounds = 64) => C.diffusionSummary(await C.diffusionExperiment({ algo, rounds, inputs: 100, randomBytes: C.seededBytes(7) }));
  for (const algo of ['SHA-256', 'MD5', 'SHA-1']) {
    const r = await C.diffusionExperiment({ algo, inputs: 100, randomBytes: C.seededBytes(7) });
    const s = C.diffusionSummary(r);
    assert.equal(r.m, 64);
    assert.equal(r.n, C.BITS[algo]);
    assert.equal(r.hist.reduce((x, y) => x + y, 0), 6400, algo);
    assert.equal(r.counts.reduce((x, y) => x + y, 0), r.hist.reduce((x, y, d) => x + y * d, 0), algo);
    assert.ok(Math.abs(s.mean - s.theoryMean) < 1, `${algo} ${s.mean}`);
    assert.ok(Math.abs(s.sd - s.theorySd) / s.theorySd < 0.05, `${algo} ${s.sd}`);
    assert.ok(Math.abs(s.within - 0.95) < 0.03, `${algo} ${s.within}`);
    assert.ok(Math.abs(s.sacMeanDev / s.sacExpectedDev - 1) < 0.05, `${algo} ${s.sacMeanDev}`);
    assert.deepEqual([s.zeroCells, s.oneCells], [0, 0], algo);
  }
  const toy = await run('ToyHash16');
  assert.ok(toy.mean < 3 && toy.within < 0.3 && toy.zeroCells > 500, JSON.stringify(toy));
  const zeros = [];
  for (const r of [1, 2, 4, 8, 64]) zeros.push((await run('SHA-256-R', r)).zeroCells);
  assert.ok(zeros[0] > 15000 && zeros[0] > zeros[1] && zeros[1] > zeros[2] && zeros[2] > 1000, zeros.join());
  assert.deepEqual(zeros.slice(3), [0, 0]);
  // 64ラウンドの自前の SHA-256 は、Web Crypto の SHA-256 と同じ結果になる
  const a = await C.diffusionExperiment({ algo: 'SHA-256-R', rounds: 64, inputs: 20, randomBytes: C.seededBytes(3) });
  const b = await C.diffusionExperiment({ algo: 'SHA-256', inputs: 20, randomBytes: C.seededBytes(3) });
  assert.deepEqual([...a.counts], [...b.counts]);
  assert.throws(() => C.hasher('SHA-3'), /unknown algorithm/);
  assert.deepEqual([C.DIFF_ALGOS, C.DIFF_ROUNDS, C.DIFF_INPUTS], [['MD5', 'SHA-1', 'SHA-256', 'SHA-512', 'ToyHash16', 'SHA-256-R'],
    [1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64], [100, 300, 1000]]);
});
