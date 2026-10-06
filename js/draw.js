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

  globalThis.HashVizDraw = { grid, cubes };
})();
