// HashViz の計算部（DOM を使わない）。globalThis.HashVizCore に置く
// - ハッシュ: MD5（RFC 1321 を自前で実装）、SHA-1・SHA-256・SHA-512（Web Crypto）、ToyHash16（バイトの和 mod 65536）
// - 入力の読み取り（文字列・16進・Base64）、ビットの比較、アバランシェの理論値（二項分布）、ダイジェストの統計
// - 衝突の組（出典つき）、2D のグリッドと 3D の配置、3D の投影
(() => {
  'use strict';

  const ALGOS = ['MD5', 'SHA-1', 'SHA-256', 'SHA-512', 'ToyHash16'];
  const BITS = { MD5: 128, 'SHA-1': 160, 'SHA-256': 256, 'SHA-512': 512, ToyHash16: 16 };
  const FORMATS = ['text', 'hex', 'base64'];
  // 1回に扱う入力の上限（バイト）。画面の欄の文字数の上限より大きくしてある
  const MAX_BYTES = 400000;

  // ===== MD5（RFC 1321） =====
  const MD5_IV = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476];
  const MD5_S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
  ];
  // RFC 1321 の表 T[1..64]（floor(abs(sin(i)) * 2^32)）。Math.sin の丸めに頼らないよう値で持つ
  const MD5_K = [
    0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
    0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
    0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
    0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
    0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
    0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
    0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
    0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391
  ];

  // メッセージを64バイトの倍数に伸ばす（0x80、0 の並び、元のビット長を64ビットのリトルエンディアンで）
  function md5Pad(bytes) {
    const len = bytes.length;
    const total = Math.ceil((len + 9) / 64) * 64;
    const out = new Uint8Array(total);
    out.set(bytes);
    out[len] = 0x80;
    const view = new DataView(out.buffer);
    view.setUint32(total - 8, (len * 8) >>> 0, true);
    view.setUint32(total - 4, Math.floor((len * 8) / 2 ** 32), true);
    return out;
  }

  // 64バイトの1ブロックを圧縮する。state は [A, B, C, D]（32ビットの符号なし整数）
  function md5Compress(state, block, offset = 0) {
    const m = new Array(16);
    for (let i = 0; i < 16; i++) {
      const o = offset + i * 4;
      m[i] = (block[o] | (block[o + 1] << 8) | (block[o + 2] << 16) | (block[o + 3] << 24)) >>> 0;
    }
    let [a, b, c, d] = state;
    for (let i = 0; i < 64; i++) {
      let f;
      let g;
      if (i < 16) {
        f = (b & c) | (~b & d);
        g = i;
      } else if (i < 32) {
        f = (d & b) | (~d & c);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        f = b ^ c ^ d;
        g = (3 * i + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * i) % 16;
      }
      const x = (a + (f >>> 0) + MD5_K[i] + m[g]) >>> 0;
      const s = MD5_S[i];
      a = d;
      d = c;
      c = b;
      b = (b + (((x << s) | (x >>> (32 - s))) >>> 0)) >>> 0;
    }
    return [(state[0] + a) >>> 0, (state[1] + b) >>> 0, (state[2] + c) >>> 0, (state[3] + d) >>> 0];
  }

  // パディングしたメッセージの各ブロックのあとの内部状態（IHV）。先頭は初期値
  function md5Chain(bytes) {
    const p = md5Pad(bytes);
    const states = [MD5_IV.slice()];
    for (let o = 0; o < p.length; o += 64) states.push(md5Compress(states[states.length - 1], p, o));
    return states;
  }

  // 内部状態をダイジェストのバイト列にする（各語をリトルエンディアンで）
  function md5StateBytes(state) {
    const out = new Uint8Array(16);
    state.forEach((w, i) => {
      for (let j = 0; j < 4; j++) out[i * 4 + j] = (w >>> (8 * j)) & 0xff;
    });
    return out;
  }

  const md5 = (bytes) => {
    const chain = md5Chain(bytes);
    return md5StateBytes(chain[chain.length - 1]);
  };

  // ===== SHA-1（FIPS 180-4） =====
  // ダイジェストの計算は Web Crypto で行う。ここではブロックごとの内部状態を見せるために自前で持つ
  const SHA1_IV = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];

  // MD5 と同じ伸ばし方だが、元のビット長はビッグエンディアンで書く
  function sha1Pad(bytes) {
    const len = bytes.length;
    const total = Math.ceil((len + 9) / 64) * 64;
    const out = new Uint8Array(total);
    out.set(bytes);
    out[len] = 0x80;
    const view = new DataView(out.buffer);
    view.setUint32(total - 8, Math.floor((len * 8) / 2 ** 32), false);
    view.setUint32(total - 4, (len * 8) >>> 0, false);
    return out;
  }

  // 64バイトの1ブロックを圧縮する。state は [H0, H1, H2, H3, H4]
  function sha1Compress(state, block, offset = 0) {
    const w = new Array(80);
    for (let i = 0; i < 16; i++) {
      const o = offset + i * 4;
      w[i] = ((block[o] << 24) | (block[o + 1] << 16) | (block[o + 2] << 8) | block[o + 3]) >>> 0;
    }
    for (let i = 16; i < 80; i++) {
      const x = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16];
      w[i] = ((x << 1) | (x >>> 31)) >>> 0;
    }
    let [a, b, c, d, e] = state;
    for (let i = 0; i < 80; i++) {
      let f;
      let k;
      if (i < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (i < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      const t = ((((a << 5) | (a >>> 27)) >>> 0) + (f >>> 0) + e + k + w[i]) >>> 0;
      e = d;
      d = c;
      c = ((b << 30) | (b >>> 2)) >>> 0;
      b = a;
      a = t;
    }
    return [a, b, c, d, e].map((x, i) => (state[i] + x) >>> 0);
  }

  function sha1Chain(bytes) {
    const p = sha1Pad(bytes);
    const states = [SHA1_IV.slice()];
    for (let o = 0; o < p.length; o += 64) states.push(sha1Compress(states[states.length - 1], p, o));
    return states;
  }

  // 内部状態をダイジェストのバイト列にする（各語をビッグエンディアンで）
  function sha1StateBytes(state) {
    const out = new Uint8Array(20);
    state.forEach((w, i) => {
      for (let j = 0; j < 4; j++) out[i * 4 + j] = (w >>> (24 - 8 * j)) & 0xff;
    });
    return out;
  }

  const sha1 = (bytes) => {
    const chain = sha1Chain(bytes);
    return sha1StateBytes(chain[chain.length - 1]);
  };

  // ===== ブロックごとの内部状態の比べ方（MD5・SHA-1） =====
  const CHAINS = {
    MD5: { pad: md5Pad, chain: md5Chain, bytes: md5StateBytes },
    'SHA-1': { pad: sha1Pad, chain: sha1Chain, bytes: sha1StateBytes }
  };
  const CHAIN_ALGOS = Object.keys(CHAINS);

  const concatBytes = (...parts) => {
    const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
    let o = 0;
    for (const p of parts) {
      out.set(p, o);
      o += p.length;
    }
    return out;
  };

  // 2つの入力の前（prefix）か後ろ（suffix）に、同じバイト列を足す。none なら元のまま
  function extendPair(a, b, extra, where) {
    if (where === 'suffix') return [concatBytes(a, extra), concatBytes(b, extra)];
    if (where === 'prefix') return [concatBytes(extra, a), concatBytes(extra, b)];
    if (where === 'none') return [a, b];
    throw new Error(`unknown position: ${where}`);
  }

  // パディングしたメッセージを1ブロックずつ圧縮し、各ブロックのあとの内部状態を A・B で並べる。
  // suffixSafe は「後ろに何を足しても衝突が保たれる」こと（同じ長さで、メッセージの中のブロックの区切りで内部状態がそろい、
  // そのあとのメッセージが同じ）。converge はそのブロックの番号（1始まり）
  function chainCompare(algo, a, b) {
    const c = CHAINS[algo];
    if (!c) throw new Error(`no chain for ${algo}`);
    const [pa, pb] = [c.pad(a), c.pad(b)];
    const [sa, sb] = [c.chain(a), c.chain(b)];
    const hex = (st) => toHex(c.bytes(st));
    const same = (i) => i < sa.length && i < sb.length && hex(sa[i]) === hex(sb[i]);
    const blocks = Math.max(sa.length, sb.length) - 1;
    const rows = [{ index: 0, stateA: hex(sa[0]), stateB: hex(sb[0]), same: true, inputDiffers: false, padding: false }];
    for (let i = 1; i <= blocks; i++) {
      const from = (i - 1) * 64;
      let differs = pa.length !== pb.length;
      for (let k = from; k < from + 64 && !differs; k++) if (pa[k] !== pb[k]) differs = true;
      rows.push({
        index: i, from, to: from + 63, inputDiffers: differs, padding: from + 64 > Math.min(a.length, b.length),
        stateA: i < sa.length ? hex(sa[i]) : null, stateB: i < sb.length ? hex(sb[i]) : null, same: same(i)
      });
    }
    let converge = 0;
    if (a.length === b.length) {
      for (let j = 1; j * 64 <= a.length; j++) {
        if (!same(j)) continue;
        let rest = true;
        for (let k = j * 64; k < a.length && rest; k++) if (a[k] !== b[k]) rest = false;
        if (rest) {
          converge = j;
          break;
        }
      }
    }
    return { algo, rows, blocks, finalSame: same(blocks), suffixSafe: converge > 0, converge, words: algo === 'MD5' ? 4 : 5 };
  }

  // 教育用の弱いハッシュ。バイトの和を 65536 で割った余りを2バイト（上位・下位）で返す
  function toyHash16(bytes) {
    let s = 0;
    for (const x of bytes) s = (s + x) & 0xffff;
    return Uint8Array.of(s >>> 8, s & 0xff);
  }

  // algo のダイジェスト（Uint8Array）。SHA 系は Web Crypto を使う（使えない環境では 'nosubtle' の例外）
  async function digest(algo, bytes) {
    if (algo === 'MD5') return md5(bytes);
    if (algo === 'ToyHash16') return toyHash16(bytes);
    if (!BITS[algo]) throw new Error(`unknown algorithm: ${algo}`);
    const subtle = globalThis.crypto && globalThis.crypto.subtle;
    if (!subtle) throw new Error('nosubtle');
    return new Uint8Array(await subtle.digest(algo, bytes));
  }

  // ===== 入力の読み取り =====
  const encoder = new TextEncoder();
  const utf8 = (text) => encoder.encode(String(text));

  // UTF-8 として読めればその文字列、読めなければ null
  function decodeUtf8(bytes) {
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      return null;
    }
  }

  // 最初の不正な文字（サロゲートペアは1文字として返す）
  const firstBad = (s, re) => {
    const m = s.match(re);
    return m ? String.fromCodePoint(s.codePointAt(m.index)) : null;
  };

  // 16進: 空白・改行は無視し、先頭の 0x を1つだけ外す
  function parseHex(text) {
    let s = String(text).replace(/\s+/g, '');
    if (/^0x/i.test(s)) s = s.slice(2);
    const bad = firstBad(s, /[^0-9a-fA-F]/);
    if (bad !== null) return { ok: false, error: 'hex-char', char: bad };
    if (s.length % 2) return { ok: false, error: 'hex-odd', digits: s.length };
    const out = new Uint8Array(s.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
    return { ok: true, bytes: out };
  }

  // Base64: 標準（+ /）と URL 用（- _）を受け付ける。空白は無視し、末尾の = は省いてもよい
  function parseBase64(text) {
    const s = String(text).replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
    const m = s.match(/^([A-Za-z0-9+/]*)(=*)$/);
    if (!m) return { ok: false, error: 'b64-char', char: firstBad(s.replace(/=+$/, ''), /[^A-Za-z0-9+/]/) || '=' };
    const [, body, pad] = m;
    if (body.length % 4 === 1 || pad.length > 2 || (pad && (body.length + pad.length) % 4)) return { ok: false, error: 'b64-length' };
    const bin = atob(body + '='.repeat((4 - (body.length % 4)) % 4));
    return { ok: true, bytes: Uint8Array.from(bin, (c) => c.charCodeAt(0)) };
  }

  // format（text・hex・base64）に従ってバイト列にする
  function parseInput(text, format) {
    let r;
    if (format === 'hex') r = parseHex(text);
    else if (format === 'base64') r = parseBase64(text);
    else if (format === 'text') r = { ok: true, bytes: utf8(text) };
    else throw new Error(`unknown format: ${format}`);
    if (r.ok && r.bytes.length > MAX_BYTES) return { ok: false, error: 'too-long', bytes: r.bytes.length, max: MAX_BYTES };
    return r;
  }

  // ===== バイトとビット =====
  const toHex = (bytes) => Array.from(bytes, (x) => x.toString(16).padStart(2, '0')).join('');

  // 16バイトで改行、4バイトごとに空白（16進の入力欄に入れる形）
  function formatHex(bytes) {
    const hex = toHex(bytes);
    const lines = [];
    for (let i = 0; i < hex.length; i += 32) lines.push(hex.slice(i, i + 32).replace(/(.{8})(?=.)/g, '$1 '));
    return lines.join('\n');
  }

  const toBinary = (byte) => byte.toString(2).padStart(8, '0');

  // ダイジェストのビットを上位から並べる（ビット番号 i は i/8 バイト目の上から i%8 番目）
  function bytesToBits(bytes) {
    const bits = new Uint8Array(bytes.length * 8);
    for (let i = 0; i < bytes.length; i++) {
      for (let j = 0; j < 8; j++) bits[i * 8 + j] = (bytes[i] >> (7 - j)) & 1;
    }
    return bits;
  }

  // 同じ長さの2つのダイジェストの、ビットごとの違い（1＝違う）と違うビットの数
  function diffBits(a, b) {
    if (a.length !== b.length) throw new Error('length mismatch');
    const bits = bytesToBits(a.map((x, i) => x ^ b[i]));
    return { bits, count: bits.reduce((s, x) => s + x, 0) };
  }

  // 2つの入力の、違うバイトの位置（長さが違えば、短いほうの外側も違いとして数える）
  function byteDiff(a, b) {
    const positions = [];
    for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) positions.push(i);
    return { positions, lengthA: a.length, lengthB: b.length };
  }

  // ===== アバランシェ =====
  // 整数の文字列だけを受け付ける（"1.5"・"1e2"・"-1"・空は NaN）
  const parseIndex = (s) => (/^\s*\d+\s*$/.test(String(s)) ? Number(s) : NaN);

  // bytes の byteIndex バイト目の bitIndex ビット目（0＝最下位）を反転する。範囲外は丸めずに理由を返す
  function flipBit(bytes, byteIndex, bitIndex) {
    if (!bytes.length) return { ok: false, error: 'empty' };
    if (!Number.isInteger(byteIndex) || byteIndex < 0 || byteIndex >= bytes.length) {
      return { ok: false, error: 'byte-range', max: bytes.length - 1 };
    }
    if (!Number.isInteger(bitIndex) || bitIndex < 0 || bitIndex > 7) return { ok: false, error: 'bit-range' };
    const out = Uint8Array.from(bytes);
    out[byteIndex] ^= 1 << bitIndex;
    return { ok: true, bytes: out, before: bytes[byteIndex], after: out[byteIndex] };
  }

  // UTF-8 で byteIndex バイト目を含む文字と、その文字の何バイト目か（1始まり）
  function byteOwner(text, byteIndex) {
    let pos = 0;
    let index = 0;
    for (const ch of String(text)) {
      const n = utf8(ch).length;
      if (byteIndex < pos + n) {
        const cp = `U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`;
        return { char: ch, cp, index, byteInChar: byteIndex - pos + 1, charBytes: n };
      }
      pos += n;
      index += 1;
    }
    return null;
  }

  // 二項分布 B(n, 1/2)。1ビットの反転で変わる出力ビット数の、理想的なハッシュでの分布
  // lo は「k 以下になる確率が alpha/2 を超える」最小の k、hi は左右対称で n - lo（中央の 1 - alpha 以上を含む）
  function binomialRange(n, alpha = 0.05) {
    const lf = [0];
    for (let k = 1; k <= n; k++) lf[k] = lf[k - 1] + Math.log(k);
    let cdf = 0;
    let lo = 0;
    for (let k = 0; k <= n; k++) {
      cdf += Math.exp(lf[n] - lf[k] - lf[n - k] - n * Math.LN2);
      if (cdf > alpha / 2) {
        lo = k;
        break;
      }
    }
    return { n, mean: n / 2, sd: Math.sqrt(n) / 2, lo, hi: n - lo };
  }

  // 違うビット数 d が理論の範囲の内（within）か、少なすぎ（low）・多すぎ（high）か
  function avalancheVerdict(d, n) {
    const r = binomialRange(n);
    if (d < r.lo) return 'low';
    if (d > r.hi) return 'high';
    return 'within';
  }

  // 1つのダイジェストの0と1の偏り（ハッシュの強さを示す数ではない）
  function digestStats(bytes) {
    const bits = bytesToBits(bytes);
    const n = bits.length;
    const ones = bits.reduce((s, x) => s + x, 0);
    const p = n ? ones / n : 0;
    const h = (x) => (x > 0 ? -x * Math.log2(x) : 0);
    let runs = n ? 1 : 0;
    let maxRun = n ? 1 : 0;
    let cur = 1;
    for (let i = 1; i < n; i++) {
      if (bits[i] === bits[i - 1]) {
        cur += 1;
      } else {
        runs += 1;
        cur = 1;
      }
      maxRun = Math.max(maxRun, cur);
    }
    return { bits: n, ones, zeros: n - ones, onesRatio: p, entropy: h(p) + h(1 - p), runs, maxRun,
      bytes: bytes.length, uniqueBytes: new Set(bytes).size };
  }

  // ===== 2D のグリッドと 3D の配置 =====
  const GRID = { 16: [4, 4], 128: [16, 8], 160: [20, 8], 256: [16, 16], 512: [32, 16] };
  const VOXEL = { 16: [4, 2, 2], 128: [8, 4, 4], 160: [8, 5, 4], 256: [8, 8, 4], 512: [8, 8, 8] };

  function gridShape(n) {
    if (GRID[n]) return { cols: GRID[n][0], rows: GRID[n][1] };
    const cols = Math.max(1, Math.ceil(Math.sqrt(n)));
    return { cols, rows: Math.max(1, Math.ceil(n / cols)) };
  }

  function voxelShape(n) {
    if (VOXEL[n]) return { cols: VOXEL[n][0], rows: VOXEL[n][1], layers: VOXEL[n][2] };
    const layers = Math.max(1, Math.round(Math.cbrt(n)));
    const rows = Math.max(1, Math.ceil(Math.sqrt(n / layers)));
    return { cols: Math.max(1, Math.ceil(n / (layers * rows))), rows, layers };
  }

  // ビット i の立方体の中心。2D と同じ順（左から右、行が終われば下の行、1層が終われば奥の層）。
  // 原点が全体の中心で、x は右、y は上、z は手前が正
  function voxelCenter(i, shape) {
    const per = shape.cols * shape.rows;
    const layer = Math.floor(i / per);
    const row = Math.floor((i % per) / shape.cols);
    const col = i % shape.cols;
    return [col - (shape.cols - 1) / 2, (shape.rows - 1) / 2 - row, (shape.layers - 1) / 2 - layer];
  }

  // 点を y 軸まわりに yaw、x 軸まわりに pitch だけ回す（ラジアン）
  function rotate([x, y, z], yaw, pitch) {
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const x1 = x * cy + z * sy;
    const z1 = -x * sy + z * cy;
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    return [x1, y * cp - z1 * sp, y * sp + z1 * cp];
  }

  // 立方体の8つの角（k の各ビットが x・y・z の正負）と6つの面（角の番号と法線）
  const CORNERS = Array.from({ length: 8 }, (_, k) => [k & 1 ? 1 : -1, k & 2 ? 1 : -1, k & 4 ? 1 : -1]);
  const FACES = [
    { c: [1, 3, 7, 5], n: [1, 0, 0] }, { c: [0, 4, 6, 2], n: [-1, 0, 0] },
    { c: [2, 6, 7, 3], n: [0, 1, 0] }, { c: [0, 1, 5, 4], n: [0, -1, 0] },
    { c: [4, 5, 7, 6], n: [0, 0, 1] }, { c: [0, 2, 3, 1], n: [0, 0, -1] }
  ];
  const LIGHT = (() => {
    const v = [-0.45, 0.6, 0.66];
    const len = Math.hypot(...v);
    return v.map((x) => x / len);
  })();
  const VOXEL_HALF = { 1: 0.36, 0: 0.13 };

  // 3D の絵を、奥から順に塗る多角形の並びにする（画家のアルゴリズム）。
  // bits は 0/1、marks は強調するビット番号の集合。返す多角形は { bit, index, mark, shade, pts }（pts は画面の座標）
  function scene3d(bits, { width, height, yaw = 0, pitch = 0, marks = new Set() }) {
    const shape = voxelShape(bits.length);
    const radius = 0.5 * Math.hypot(shape.cols, shape.rows, shape.layers);
    const scale = (Math.min(width, height) * 0.42) / radius;
    const dist = radius * 4;
    const cx = width / 2;
    const cy = height / 2;
    const cubes = [];
    for (let i = 0; i < bits.length; i++) {
      const center = voxelCenter(i, shape);
      cubes.push({ i, center, z: rotate(center, yaw, pitch)[2] });
    }
    cubes.sort((p, q) => p.z - q.z || q.i - p.i);
    const polys = [];
    for (const { i, center } of cubes) {
      const bit = bits[i];
      const half = VOXEL_HALF[bit];
      const pts = CORNERS.map((c) => {
        const [x, y, z] = rotate([center[0] + c[0] * half, center[1] + c[1] * half, center[2] + c[2] * half], yaw, pitch);
        const f = dist / (dist - z);
        return [cx + x * scale * f, cy - y * scale * f];
      });
      for (const face of FACES) {
        const n = rotate(face.n, yaw, pitch);
        if (n[2] <= 1e-9) continue;
        const light = n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2];
        polys.push({ bit, index: i, mark: marks.has(i), shade: 0.55 + 0.45 * Math.max(0, light), pts: face.c.map((k) => pts[k]) });
      }
    }
    return polys;
  }

  // 2D のグリッドで、画面上の点（キャンバスの座標）が当たるビット番号。外なら -1
  function gridCellAt(n, width, height, x, y) {
    const { cols, rows } = gridShape(n);
    const cell = Math.min(width / cols, height / rows);
    const ox = (width - cell * cols) / 2;
    const oy = (height - cell * rows) / 2;
    const c = Math.floor((x - ox) / cell);
    const r = Math.floor((y - oy) / cell);
    if (c < 0 || r < 0 || c >= cols || r >= rows) return -1;
    const i = r * cols + c;
    return i < n ? i : -1;
  }

  // ===== 衝突の組 =====
  // 本物の衝突は、論文や配布元のデータそのまま（Node の crypto で一致を確かめてある）。出典は画面にも出す
  const SAMPLES = [
    {
      id: 'md5-wang2004', algo: 'MD5', format: 'hex',
      a: [
        'd131dd02c5e6eec4693d9a0698aff95c2fcab58712467eab4004583eb8fb7f8955ad340609f4b30283e488832571415a085125e8f7cdc99fd91dbdf280373c5b',
        'd8823e3156348f5bae6dacd436c919c6dd53e2b487da03fd02396306d248cda0e99f33420f577ee8ce54b67080a80d1ec69821bcb6a8839396f9652b6ff72a70'
      ].join(''),
      b: [
        'd131dd02c5e6eec4693d9a0698aff95c2fcab50712467eab4004583eb8fb7f8955ad340609f4b30283e4888325f1415a085125e8f7cdc99fd91dbd7280373c5b',
        'd8823e3156348f5bae6dacd436c919c6dd53e23487da03fd02396306d248cda0e99f33420f577ee8ce54b67080280d1ec69821bcb6a8839396f965ab6ff72a70'
      ].join(''),
      sources: [
        { label: 'X. Wang, D. Feng, X. Lai, H. Yu: Collisions for Hash Functions MD4, MD5, HAVAL-128 and RIPEMD (IACR ePrint 2004/199)',
          url: 'https://eprint.iacr.org/2004/199' }
      ]
    },
    {
      id: 'md5-stevens2012', algo: 'MD5', format: 'hex',
      a: '4dc968ff0ee35c209572d4777b721587d36fa7b21bdc56b74a3dc0783e7b9518afbfa200a8284bf36e8e4b55b35f427593d849676da0d1555d8360fb5f07fea2',
      b: '4dc968ff0ee35c209572d4777b721587d36fa7b21bdc56b74a3dc0783e7b9518afbfa202a8284bf36e8e4b55b35f427593d849676da0d1d55d8360fb5f07fea2',
      sources: [
        { label: 'M. Stevens: Single-block collision attack on MD5 (IACR ePrint 2012/040)',
          url: 'https://eprint.iacr.org/2012/040' },
        { label: 'marc-stevens.nl: message1.bin / message2.bin',
          url: 'https://marc-stevens.nl/research/md5-1block-collision/' }
      ]
    },
    {
      id: 'md5-textcoll', algo: 'MD5', format: 'text',
      a: 'TEXTCOLLBYfGiJUETHQ4hAcKSMd5zYpgqf1YRDhkmxHkhPWptrkoyz28wnI9V0aHeAuaKnak',
      b: 'TEXTCOLLBYfGiJUETHQ4hEcKSMd5zYpgqf1YRDhkmxHkhPWptrkoyz28wnI9V0aHeAuaKnak',
      sources: [
        { label: 'Project HashClash (M. Stevens, MIT License): README, textcoll',
          url: 'https://github.com/cr-marcstevens/hashclash' },
        { label: 'corkami/collisions: examples/free (short-1.txt / short-2.txt)',
          url: 'https://github.com/corkami/collisions' }
      ]
    },
    {
      id: 'md5-textcoll128', algo: 'MD5', format: 'text',
      a: 'TEXTCOLLBYfGiJUETHQ4hAcKSMd5zYpgqf1YRDhkmxHkhPWptrkoyz28wnI9V0aHmSZaAAAA()(()()(()((((((()((()((()())))()(()))))())(())))))()(()',
      b: 'TEXTCOLLBYfGiJUETHQ4hEcKSMd5zYpgqf1YRDhkmxHkhPWptrkoyz28wnI9V0aHmSZaAAAA()(()()(()((((((()((()((()())))()(()))))())(())))))()(()',
      sources: [
        { label: 'corkami/collisions: examples/free (lisp-1.txt / lisp-2.txt)',
          url: 'https://github.com/corkami/collisions' },
        { label: 'Project HashClash (M. Stevens, MIT License): textcoll',
          url: 'https://github.com/cr-marcstevens/hashclash' }
      ]
    },
    {
      id: 'sha1-shattered', algo: 'SHA-1', format: 'hex',
      a: [
        '255044462d312e330a25e2e3cfd30a0a0a312030206f626a0a3c3c2f57696474682032203020522f4865696768742033203020522f547970652034203020522f',
        '537562747970652035203020522f46696c7465722036203020522f436f6c6f7253706163652037203020522f4c656e6774682038203020522f42697473506572',
        '436f6d706f6e656e7420383e3e0a73747265616d0affd8fffe00245348412d3120697320646561642121212121852fec092339759c39b1a1c63c4c97e1fffe01',
        '7346dc9166b67e118f029ab621b2560ff9ca67cca8c7f85ba84c79030c2b3de218f86db3a90901d5df45c14f26fedfb3dc38e96ac22fe7bd728f0e45bce046d2',
        '3c570feb141398bb552ef5a0a82be331fea48037b8b5d71f0e332edf93ac3500eb4ddc0decc1a864790c782c76215660dd309791d06bd0af3f98cda4bc4629b1'
      ].join(''),
      b: [
        '255044462d312e330a25e2e3cfd30a0a0a312030206f626a0a3c3c2f57696474682032203020522f4865696768742033203020522f547970652034203020522f',
        '537562747970652035203020522f46696c7465722036203020522f436f6c6f7253706163652037203020522f4c656e6774682038203020522f42697473506572',
        '436f6d706f6e656e7420383e3e0a73747265616d0affd8fffe00245348412d3120697320646561642121212121852fec092339759c39b1a1c63c4c97e1fffe01',
        '7f46dc93a6b67e013b029aaa1db2560b45ca67d688c7f84b8c4c791fe02b3df614f86db1690901c56b45c1530afedfb76038e972722fe7ad728f0e4904e046c2',
        '30570fe9d41398abe12ef5bc942be33542a4802d98b5d70f2a332ec37fac3514e74ddc0f2cc1a874cd0c78305a21566461309789606bd0bf3f98cda8044629a1'
      ].join(''),
      sources: [
        { label: 'M. Stevens, E. Bursztein, P. Karpman, A. Albertini, Y. Markov: The first collision for full SHA-1 (IACR ePrint 2017/190)',
          url: 'https://eprint.iacr.org/2017/190' },
        { label: 'Google Security Blog: Announcing the first SHA1 collision (2017-02-23)',
          url: 'https://security.googleblog.com/2017/02/announcing-first-sha1-collision.html' }
      ]
    },
    {
      id: 'toy-ab', algo: 'ToyHash16', format: 'hex',
      a: '4142',
      b: '83',
      sources: []
    },
    {
      id: 'toy-abc', algo: 'ToyHash16', format: 'hex',
      a: '414243',
      b: 'c6',
      sources: []
    }
  ];

  // 2つの入力を、すべてのアルゴリズムで比べる
  async function compareAll(a, b) {
    const out = [];
    for (const algo of ALGOS) {
      const [x, y] = await Promise.all([digest(algo, a), digest(algo, b)]);
      out.push({ algo, same: toHex(x) === toHex(y), a: x, b: y });
    }
    return out;
  }

  // ===== 誕生日攻撃 =====
  const BIRTHDAY_BITS = [8, 12, 16, 20, 24, 28, 32, 36];
  const BIRTHDAY_ALGOS = ['MD5', 'SHA-1', 'SHA-256', 'SHA-512'];
  // アルゴリズム全体での誕生日攻撃の目安（2^(n/2)）と、知られている衝突攻撃の計算量（2の何乗か）。
  // MD5 は同一プレフィックス衝突で約2^16回の圧縮関数、SHA-1 は SHAttered の約2^63.1回（どちらも Stevens ら 2017 の論文による）
  const BIRTHDAY_LIMITS = [
    { algo: 'MD5', bits: 128, birthday: 64, attack: 16 },
    { algo: 'SHA-1', bits: 160, birthday: 80, attack: 63.1 },
    { algo: 'SHA-256', bits: 256, birthday: 128, attack: null },
    { algo: 'SHA-512', bits: 512, birthday: 256, attack: null }
  ];

  // ダイジェストの先頭 n ビット（1〜48）を、上位から読んだ数にする
  function truncateBits(bytes, n) {
    if (!Number.isInteger(n) || n < 1 || n > 48 || n > bytes.length * 8) throw new Error(`bad bit count: ${n}`);
    let v = 0;
    const full = Math.floor(n / 8);
    for (let i = 0; i < full; i++) v = v * 256 + bytes[i];
    const rest = n % 8;
    if (rest) v = v * 2 ** rest + (bytes[full] >> (8 - rest));
    return v;
  }

  // 最初の衝突までの試行回数の期待値 √(π/2·2^n)
  const birthdayExpected = (n) => Math.sqrt((Math.PI / 2) * 2 ** n);
  // k 回までに衝突が見つかる確率の近似 1 − exp(−k(k−1)/2^(n+1))
  const birthdayCdf = (k, n) => 1 - Math.exp(-(k * (k - 1)) / 2 ** (n + 1));
  // 試す文。種と番号で決まる（同じ種なら同じ結果になる）
  const birthdayMessage = (seed, i) => `${seed}-${i}`;

  // 先頭 n ビットが同じになる2つの文を探す。birthdayMessage(seed, 0)、(seed, 1)、… の順にハッシュし、
  // batch 個ごとに onProgress(tries) を呼び、pause() を待つ（画面がイベントを処理できるように）。shouldStop() が true なら null を返す
  async function birthdaySearch({ algo, n, seed, batch = 512, onProgress, shouldStop, pause }) {
    if (!BIRTHDAY_ALGOS.includes(algo)) throw new Error(`unknown algorithm: ${algo}`);
    const seen = new Map();
    for (let i = 0; ; i += batch) {
      if (shouldStop && shouldStop()) return null;
      const msgs = Array.from({ length: batch }, (_, k) => birthdayMessage(seed, i + k));
      const ds = await Promise.all(msgs.map((m) => digest(algo, utf8(m))));
      for (let k = 0; k < batch; k++) {
        const v = truncateBits(ds[k], n);
        const prev = seen.get(v);
        if (prev !== undefined) {
          return { tries: i + k + 1, value: v, a: birthdayMessage(seed, prev), b: msgs[k], indexA: prev, indexB: i + k };
        }
        seen.set(v, i + k);
      }
      if (onProgress) onProgress(i + batch);
      if (pause) await pause();
    }
  }

  // 試行回数の並びのまとめ（平均・中央値・最小・最大と、理論の期待値との比）
  function birthdaySummary(samples, n) {
    const s = [...samples].sort((p, q) => p - q);
    const mean = s.reduce((x, y) => x + y, 0) / s.length;
    const mid = s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
    return { count: s.length, mean, median: mid, min: s[0], max: s[s.length - 1], expected: birthdayExpected(n), ratio: mean / birthdayExpected(n) };
  }

  globalThis.HashVizCore = {
    ALGOS, BITS, FORMATS, MAX_BYTES, SAMPLES,
    md5, md5Pad, md5Compress, md5Chain, md5StateBytes, toyHash16, digest, compareAll,
    sha1, sha1Pad, sha1Compress, sha1Chain, sha1StateBytes, CHAIN_ALGOS, concatBytes, extendPair, chainCompare,
    BIRTHDAY_BITS, BIRTHDAY_ALGOS, BIRTHDAY_LIMITS, truncateBits, birthdayExpected, birthdayCdf, birthdayMessage, birthdaySearch, birthdaySummary,
    utf8, decodeUtf8, parseHex, parseBase64, parseInput,
    toHex, formatHex, toBinary, bytesToBits, diffBits, byteDiff,
    parseIndex, flipBit, byteOwner, binomialRange, avalancheVerdict, digestStats,
    gridShape, voxelShape, voxelCenter, rotate, scene3d, gridCellAt
  };
})();
