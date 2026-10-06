// キャンバスへの描画（2D のマス目と 3D の立方体）。globalThis.HashVizDraw に置く
// 形と投影の計算は HashVizCore（gridShape・scene3d）、色は CSS のトークン（--bit-*）から読む
(() => {
  'use strict';

  const C = globalThis.HashVizCore;

  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  // #rrggbb を [r, g, b] に
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const shaded = ([r, g, b], k) => `rgb(${Math.round(r * k)}, ${Math.round(g * k)}, ${Math.round(b * k)})`;

  // kind が digest なら 1＝明るい・0＝暗い、diff なら 1（違うビット）＝目立つ色・0＝控えめな色
  function palette(kind) {
    const diff = kind === 'diff';
    return {
      one: css(diff ? '--bit-diff' : '--bit-one'),
      zero: css(diff ? '--bit-same' : '--bit-zero'),
      bg: css('--grid-bg'),
      mark: css('--bit-mark'),
      ring: css('--card'),
      focus: css('--accent-text'),
      scene: css('--scene-bg')
    };
  }

  // 表示の幅に合わせて、描く解像度（devicePixelRatio 倍）を決める。ratio は幅÷高さ。返す w・h は CSS の px
  function fit(canvas, ratio) {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(canvas.clientWidth || 320));
    const h = Math.max(1, Math.round(w / ratio));
    const W = Math.round(w * dpr);
    const H = Math.round(h * dpr);
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }

  // 2D のマス目。marks は印を付けたビット、cursor はキーボードで選んでいるビット（-1 なら描かない）
  function grid(canvas, bits, { kind = 'digest', marks = new Set(), cursor = -1 } = {}) {
    const { cols, rows } = C.gridShape(bits.length);
    const { ctx, w, h } = fit(canvas, cols / rows);
    const p = palette(kind);
    const cell = Math.min(w / cols, h / rows);
    const ox = (w - cell * cols) / 2;
    const oy = (h - cell * rows) / 2;
    const gap = cell >= 10 ? 1 : 0.5;
    ctx.fillStyle = p.bg;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < bits.length; i++) {
      const x = ox + (i % cols) * cell;
      const y = oy + Math.floor(i / cols) * cell;
      ctx.fillStyle = bits[i] ? p.one : p.zero;
      ctx.fillRect(x + gap / 2, y + gap / 2, cell - gap, cell - gap);
    }
    const ring = (i, color, width, inset) => {
      const x = ox + (i % cols) * cell;
      const y = oy + Math.floor(i / cols) * cell;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.strokeRect(x + inset, y + inset, cell - inset * 2, cell - inset * 2);
    };
    const lw = Math.max(2, cell * 0.14);
    for (const i of marks) {
      if (i >= bits.length) continue;
      ring(i, p.mark, lw, lw / 2);
      ring(i, p.ring, 1, lw + 0.5);
    }
    if (cursor >= 0 && cursor < bits.length) {
      ctx.setLineDash([3, 2]);
      ring(cursor, p.focus, 2, 1);
      ctx.setLineDash([]);
    }
  }

  // 3D の立方体（1 は大きく、0 は小さく）。奥から順に塗る
  function cubes(canvas, bits, { kind = 'digest', marks = new Set(), yaw = 0, pitch = 0 } = {}) {
    const { ctx, w, h } = fit(canvas, 4 / 3);
    const p = palette(kind);
    const one = rgb(p.one);
    const zero = rgb(p.zero);
    const mark = rgb(p.mark);
    ctx.fillStyle = p.scene;
    ctx.fillRect(0, 0, w, h);
    ctx.lineJoin = 'round';
    for (const poly of C.scene3d(bits, { width: w, height: h, yaw, pitch, marks })) {
      ctx.beginPath();
      poly.pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fillStyle = shaded(poly.mark ? mark : poly.bit ? one : zero, poly.shade);
      ctx.fill();
      ctx.strokeStyle = p.bg;
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }
  }

  // 目盛りの上限を 1・2・5 × 10^k に切り上げる
  function niceMax(x) {
    const p = 10 ** Math.floor(Math.log10(Math.max(1, x)));
    for (const m of [1, 2, 5, 10]) if (m * p >= x) return m * p;
    return 10 * p;
  }

  // 誕生日攻撃の累積分布。理論の曲線 1−exp(−k(k−1)/2^(n+1))、実測の階段、期待値の縦の点線を描く。
  // labels は { x, y, theory, measured, expected, fmt }（fmt は数の書き方）
  function cdfChart(canvas, samples, n, labels) {
    // 狭い画面では縦を高めにする
    const { ctx, w, h } = fit(canvas, (canvas.clientWidth || 320) < 480 ? 4 / 3 : 16 / 9);
    const c = { bg: css('--card'), axis: css('--muted'), grid: css('--border'), theory: css('--accent'), measured: css('--bit-diff'), text: css('--text') };
    ctx.font = '12px "Segoe UI", system-ui, sans-serif';
    // 凡例の置き場所（幅が足りなければ次の行へ）。縦軸の名前は、1行目の右に入るときだけ書く
    const items = [[c.theory, labels.theory, false], [c.measured, labels.measured, false], [c.axis, labels.expected, true]];
    const legend = [];
    let lx = 52;
    let ly = 14;
    for (const [color, text, dash] of items) {
      const width = 28 + ctx.measureText(text).width;
      if (lx > 52 && lx + width > w - 14) {
        lx = 52;
        ly += 18;
      }
      legend.push({ color, text, dash, x: lx, y: ly });
      lx += width + 18;
    }
    const yLabel = ly === 14 && lx + ctx.measureText(labels.y).width <= w - 14;
    const pad = { l: 52, r: 14, t: ly + 20, b: 40 };
    const expected = C.birthdayExpected(n);
    const xmax = niceMax(Math.max(expected * 3, ...samples));
    const X = (k) => pad.l + (k / xmax) * (w - pad.l - pad.r);
    const Y = (p) => h - pad.b - p * (h - pad.t - pad.b);
    ctx.fillStyle = c.bg;
    ctx.fillRect(0, 0, w, h);
    ctx.lineWidth = 1;
    // 目盛り
    ctx.strokeStyle = c.grid;
    ctx.fillStyle = c.axis;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (const p of [0, 0.5, 1]) {
      ctx.beginPath();
      ctx.moveTo(pad.l, Y(p));
      ctx.lineTo(w - pad.r, Y(p));
      ctx.stroke();
      ctx.fillText(String(p), pad.l - 6, Y(p));
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (const k of [0, xmax / 2, xmax]) ctx.fillText(labels.fmt(k), Math.min(Math.max(X(k), pad.l + 10), w - pad.r - 20), h - pad.b + 6);
    ctx.fillText(labels.x, (pad.l + w - pad.r) / 2, h - 16);
    // 期待値
    ctx.strokeStyle = c.axis;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(X(expected), Y(0));
    ctx.lineTo(X(expected), Y(1));
    ctx.stroke();
    ctx.setLineDash([]);
    // 理論の曲線
    ctx.strokeStyle = c.theory;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i <= 200; i++) {
      const k = (xmax * i) / 200;
      const y = Y(C.birthdayCdf(k, n));
      if (i) ctx.lineTo(X(k), y);
      else ctx.moveTo(X(k), y);
    }
    ctx.stroke();
    // 実測の階段
    const s = [...samples].sort((p, q) => p - q);
    ctx.strokeStyle = c.measured;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(X(0), Y(0));
    s.forEach((k, i) => {
      ctx.lineTo(X(k), Y(i / s.length));
      ctx.lineTo(X(k), Y((i + 1) / s.length));
    });
    ctx.lineTo(X(xmax), Y(1));
    ctx.stroke();
    // 凡例と縦軸の名前
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (const { color, text, dash, x, y } of legend) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.setLineDash(dash ? [4, 4] : []);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 22, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = c.text;
      ctx.fillText(text, x + 28, y);
    }
    if (yLabel) {
      ctx.textAlign = 'right';
      ctx.fillStyle = c.axis;
      ctx.fillText(labels.y, w - pad.r, 14);
    }
  }

  globalThis.HashVizDraw = { grid, cubes, cdfChart };
})();
