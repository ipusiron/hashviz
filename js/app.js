// 画面の処理（DOM の組み立てとイベント）だけを書く。計算は js/hashviz-core.js（HashVizCore）、描画は js/draw.js（HashVizDraw）
// 動的な要素はすべて textContent と要素の組み立てで作る（HTML の文字列を DOM に入れない）
(() => {
  'use strict';

  const C = globalThis.HashVizCore;
  const D = globalThis.HashVizDraw;
  const I = globalThis.HashVizI18n;
  const Theme = globalThis.HashVizTheme;
  const t = (key, vars) => globalThis.HashVizMessages.t(key, vars);
  const $ = (id) => document.getElementById(id);

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  const hex2 = (x) => x.toString(16).padStart(2, '0');
  // 制御文字・書式文字は [U+XXXX] で示す
  const visible = (s) => s.replace(/[\p{Cc}\p{Cf}]/gu, (ch) => `[U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}]`);

  // ===== 知らせ（各パネルの aria-live の欄） =====
  function show(id, items) {
    $(id).replaceChildren(...items.map((x) => el('p', `msg ${x.level || 'info'}`, t(x.key, x.vars))));
  }

  const ERRORS = {
    empty: 'err.empty', 'byte-range': 'err.byteRange', 'bit-range': 'err.bitRange', 'hex-odd': 'err.hexOdd', 'hex-char': 'err.hexChar',
    'b64-char': 'err.b64Char', 'b64-length': 'err.b64Length', 'too-long': 'err.tooLong', nosubtle: 'err.nosubtle'
  };
  // 計算部の失敗（{ error, ... }）を知らせの1行にする。name があれば「入力A：…」の形にする
  function errorItem(r, name) {
    const key = ERRORS[r.error] || 'err.empty';
    const vars = { max: r.max, digits: r.digits, char: r.char, bytes: r.bytes };
    if (!name) return { key, vars, level: 'warn' };
    return { key: 'err.inputLabel', vars: { name: t(name), message: t(key, vars) }, level: 'warn' };
  }

  async function digestPair(algo, a, b) {
    try {
      return { ok: true, value: await Promise.all([C.digest(algo, a), C.digest(algo, b)]) };
    } catch (e) {
      return { ok: false, error: e && e.message === 'nosubtle' ? 'nosubtle' : 'empty' };
    }
  }

  // 16進のダイジェストを書き、other と違う桁に印を付ける
  function hexInto(node, hex, other) {
    node.replaceChildren(...[...hex].map((ch, i) => (other && other[i] !== ch ? el('span', 'chg', ch) : document.createTextNode(ch))));
  }

  // 統計の表
  function statsTable(node, bytes, caption) {
    const s = C.digestStats(bytes);
    const rows = [
      ['stats.bits', s.bits], ['stats.ones', `${s.ones} (${(s.onesRatio * 100).toFixed(1)}%)`], ['stats.zeros', s.zeros],
      ['stats.entropy', s.entropy.toFixed(4)], ['stats.runs', s.runs], ['stats.maxRun', s.maxRun], ['stats.bytes', s.bytes],
      ['stats.unique', `${s.uniqueBytes} / ${Math.min(256, s.bytes)}`]
    ];
    const table = el('table', 'stats-table');
    if (caption) table.append(el('caption', '', caption));
    const head = el('tr');
    for (const key of ['stats.item', 'stats.value']) {
      const th = el('th', '', t(key));
      th.scope = 'col';
      head.append(th);
    }
    const thead = el('thead');
    thead.append(head);
    const tbody = el('tbody');
    for (const [key, value] of rows) {
      const tr = el('tr');
      const th = el('th', '', t(key));
      th.scope = 'row';
      tr.append(th, el('td', 'mono', String(value)));
      tbody.append(tr);
    }
    table.append(thead, tbody);
    node.replaceChildren(table);
  }

  // ===== 図のまとまり（タブごと。印・3D の向き・自動回転はタブの中で共有する） =====
  const VIEW = { yaw: -0.6, pitch: 0.45 };

  function makeGroup(tab, prefix, figs) {
    return {
      tab, prefix, marks: new Set(), cursor: 0, focused: null, threeD: false, rotate: false, raf: 0, last: 0,
      yaw: VIEW.yaw, pitch: VIEW.pitch,
      figs: figs.map(([id, kind, name]) => ({ canvas: $(id), kind, name, bits: null, algo: '' }))
    };
  }
  const groups = {
    ava: makeGroup('avalanche', 'ava', [['ava-canvas-a', 'digest', 'name.inputA'], ['ava-canvas-b', 'digest', 'name.inputB'],
      ['ava-canvas-x', 'diff', 'name.diff']]),
    viz: makeGroup('viz', 'viz', [['viz-canvas', 'digest', 'name.viz']]),
    col: makeGroup('collision', 'col', [['col-canvas-a', 'digest', 'name.colA'], ['col-canvas-b', 'digest', 'name.colB']])
  };
  const GROUPS = Object.values(groups);

  const bitCount = (g) => (g.figs[0].bits ? g.figs[0].bits.length : 0);
  const visibleGroup = (g) => !$(`panel-${g.tab}`).hidden;

  // 図の名前（aria-label）は、タブが隠れていても今の言語で付け直す。描くのは見えているときだけ
  function redraw(g) {
    for (const f of g.figs) {
      f.canvas.classList.toggle('is-3d', g.threeD);
      if (!f.bits) continue;
      f.canvas.setAttribute('aria-label', t(g.threeD ? 'grid.label3d' : 'grid.label', { name: t(f.name), algo: f.algo, n: f.bits.length }));
      if (!visibleGroup(g)) continue;
      if (g.threeD) D.cubes(f.canvas, f.bits, { kind: f.kind, marks: g.marks, yaw: g.yaw, pitch: g.pitch });
      else D.grid(f.canvas, f.bits, { kind: f.kind, marks: g.marks, cursor: g.focused === f ? g.cursor : -1 });
    }
  }

  function renderMarks(g) {
    const list = [...g.marks].sort((a, b) => a - b).map((i) => t('grid.bit', { i, byte: Math.floor(i / 8), nth: (i % 8) + 1 }));
    $(`${g.prefix}-marks`).textContent = list.length ? t('grid.selected', { list: list.join(t('ui.listSep')) }) : t('grid.none');
  }

  // 新しいダイジェストを入れる。ビット数が変わったら印を消す
  function setBits(g, list, algo) {
    if (bitCount(g) !== list[0].length) {
      g.marks.clear();
      g.cursor = 0;
    }
    g.figs.forEach((f, k) => {
      f.bits = list[k];
      f.algo = algo;
    });
    renderMarks(g);
    redraw(g);
    animate(g);
  }

  function toggleMark(g, i) {
    if (g.marks.has(i)) g.marks.delete(i);
    else g.marks.add(i);
    renderMarks(g);
    redraw(g);
  }

  // 自動回転。3D・回転の指定・タブが見えている・ページが見えている、がそろったときだけ回す
  const spinning = (g) => g.rotate && g.threeD && visibleGroup(g) && !document.hidden && bitCount(g) > 0;
  function animate(g) {
    if (!spinning(g)) {
      if (g.raf) cancelAnimationFrame(g.raf);
      g.raf = 0;
      return;
    }
    if (g.raf) return;
    g.last = 0;
    const step = (now) => {
      if (!spinning(g)) {
        g.raf = 0;
        return;
      }
      if (g.last) g.yaw += Math.min(0.05, ((now - g.last) / 1000) * 0.5);
      g.last = now;
      redraw(g);
      g.raf = requestAnimationFrame(step);
    };
    g.raf = requestAnimationFrame(step);
  }

  const clampPitch = (p) => Math.max(-1.45, Math.min(1.45, p));

  function wireGroup(g) {
    const box = $(`${g.prefix}-3d`);
    const rot = $(`${g.prefix}-rotate`);
    g.syncControls = () => {
      rot.disabled = !g.threeD;
      $(`${g.prefix}-reset-view`).disabled = !g.threeD;
      $(`${g.prefix}-grid-hint`).textContent = t(g.threeD ? 'hint.3d' : 'hint.grid');
    };
    box.addEventListener('change', () => {
      g.threeD = box.checked;
      g.syncControls();
      redraw(g);
      animate(g);
    });
    rot.addEventListener('change', () => {
      g.rotate = rot.checked;
      animate(g);
    });
    $(`${g.prefix}-reset-view`).addEventListener('click', () => {
      g.yaw = VIEW.yaw;
      g.pitch = VIEW.pitch;
      redraw(g);
    });
    $(`${g.prefix}-clear`).addEventListener('click', () => {
      g.marks.clear();
      renderMarks(g);
      redraw(g);
    });
    g.syncControls();

    for (const f of g.figs) {
      const cv = f.canvas;
      let drag = null;
      cv.addEventListener('pointerdown', (e) => {
        drag = { x: e.clientX, y: e.clientY };
        if (g.threeD) cv.setPointerCapture(e.pointerId);
      });
      cv.addEventListener('pointermove', (e) => {
        if (!drag || !g.threeD) return;
        g.yaw += (e.clientX - drag.x) * 0.01;
        g.pitch = clampPitch(g.pitch + (e.clientY - drag.y) * 0.01);
        drag.x = e.clientX;
        drag.y = e.clientY;
        redraw(g);
      });
      cv.addEventListener('pointerup', (e) => {
        const d = drag;
        drag = null;
        if (!d || g.threeD || !f.bits) return;
        const r = cv.getBoundingClientRect();
        const i = C.gridCellAt(f.bits.length, r.width, r.height, e.clientX - r.left, e.clientY - r.top);
        if (i >= 0) {
          g.cursor = i;
          toggleMark(g, i);
        }
      });
      cv.addEventListener('pointercancel', () => {
        drag = null;
      });
      cv.addEventListener('focus', () => {
        g.focused = f;
        redraw(g);
      });
      cv.addEventListener('blur', () => {
        if (g.focused === f) g.focused = null;
        redraw(g);
      });
      cv.addEventListener('keydown', (e) => {
        const n = bitCount(g);
        if (!n) return;
        if (g.threeD) {
          const turn = { ArrowLeft: [-0.15, 0], ArrowRight: [0.15, 0], ArrowUp: [0, -0.15], ArrowDown: [0, 0.15] }[e.key];
          if (!turn) return;
          e.preventDefault();
          g.yaw += turn[0];
          g.pitch = clampPitch(g.pitch + turn[1]);
          redraw(g);
          return;
        }
        const { cols } = C.gridShape(n);
        const move = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols }[e.key];
        if (move !== undefined) {
          e.preventDefault();
          g.cursor = Math.max(0, Math.min(n - 1, g.cursor + move));
          redraw(g);
        } else if (e.key === 'Home' || e.key === 'End') {
          e.preventDefault();
          g.cursor = e.key === 'Home' ? 0 : n - 1;
          redraw(g);
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleMark(g, g.cursor);
        }
      });
    }
  }
  GROUPS.forEach(wireGroup);
  document.addEventListener('visibilitychange', () => GROUPS.forEach(animate));

  // 幅が変わったら描き直す（1フレームにまとめる）
  let resizeQueued = false;
  const resizeObserver = new ResizeObserver(() => {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => {
      resizeQueued = false;
      GROUPS.forEach(redraw);
      drawChart();
    });
  });
  for (const g of GROUPS) g.figs.forEach((f) => resizeObserver.observe(f.canvas.parentElement));
  resizeObserver.observe($('bd-chart').parentElement);

  // ===== タブ（WAI-ARIA のタブ。矢印キー・Home・End で移る） =====
  const TABS = ['avalanche', 'viz', 'collision', 'birthday', 'glossary'];
  let current = 'avalanche';
  function selectTab(name, focus = false) {
    current = name;
    for (const k of TABS) {
      const on = k === name;
      const tab = $(`tab-${k}`);
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      $(`panel-${k}`).hidden = !on;
      if (on && focus) tab.focus();
    }
    for (const g of GROUPS) {
      redraw(g);
      animate(g);
    }
    drawChart();
  }
  for (const k of TABS) $(`tab-${k}`).addEventListener('click', () => selectTab(k));
  $('tab-avalanche').parentElement.addEventListener('keydown', (e) => {
    const i = TABS.indexOf(current);
    const next = { ArrowRight: (i + 1) % TABS.length, ArrowLeft: (i - 1 + TABS.length) % TABS.length, Home: 0, End: TABS.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    selectTab(TABS[next], true);
  });

  // ===== アバランシェ =====
  let avaSeq = 0;
  function bitsInto(node, byte, flipped) {
    node.replaceChildren(...[...C.toBinary(byte)].map((ch, k) => (7 - k === flipped ? el('mark', 'flip', ch) : document.createTextNode(ch))));
  }

  function avaFail(items) {
    show('ava-status', items);
    $('ava-result').hidden = true;
  }

  // 反転後の入力の、反転した文字のまわり（前後30文字）
  function snippet(text, at) {
    const chars = [...text];
    const from = Math.max(0, at - 30);
    return (from ? '…' : '') + chars.slice(from, at + 30).join('') + (at + 30 < chars.length ? '…' : '');
  }

  async function renderAva() {
    const seq = ++avaSeq;
    const format = $('ava-format').value;
    const algo = $('ava-algo').value;
    const text = $('ava-input').value;
    const parsed = C.parseInput(text, format);
    if (!parsed.ok) return avaFail([errorItem(parsed)]);
    const byte = C.parseIndex($('ava-byte').value);
    const bit = C.parseIndex($('ava-bit').value);
    const f = C.flipBit(parsed.bytes, byte, bit);
    if (!f.ok) return avaFail([errorItem(f)]);
    const r = await digestPair(algo, parsed.bytes, f.bytes);
    if (seq !== avaSeq) return undefined;
    if (!r.ok) return avaFail([errorItem(r)]);
    const [da, db] = r.value;
    show('ava-status', []);
    $('ava-result').hidden = false;

    $('ava-row-byte').textContent = t('ava.rowByte', { pos: byte });
    $('ava-byte-before').textContent = `0x${hex2(f.before)}`;
    $('ava-byte-after').textContent = `0x${hex2(f.after)}`;
    bitsInto($('ava-bits-before'), f.before, bit);
    bitsInto($('ava-bits-after'), f.after, bit);
    const owner = [];
    if (format === 'text') {
      const o = C.byteOwner(text, byte);
      if (o) owner.push(t('ava.owner', { index: o.index + 1, char: visible(o.char), cp: o.cp, bytes: o.charBytes, nth: o.byteInChar }));
      const flipped = C.decodeUtf8(f.bytes);
      if (flipped === null) owner.push(t('ava.flippedInvalid'));
      else owner.push(t('ava.flippedText', { text: visible(snippet(flipped, o ? o.index : 0)) }));
    }
    $('ava-owner').textContent = owner.join(t('ui.sentenceSep'));
    $('ava-owner').hidden = !owner.length;

    const ha = C.toHex(da);
    hexInto($('ava-hex-a'), ha);
    hexInto($('ava-hex-b'), C.toHex(db), ha);
    $('ava-hex-x').textContent = C.toHex(da.map((v, i) => v ^ db[i]));
    const d = C.diffBits(da, db);
    setBits(groups.ava, [C.bytesToBits(da), C.bytesToBits(db), d.bits], algo);

    const n = d.bits.length;
    const range = C.binomialRange(n);
    $('ava-diff').textContent = t('ava.diffCount', { d: d.count, n, pct: ((d.count / n) * 100).toFixed(2) });
    $('ava-theory').textContent = t('ava.theory', { mean: range.mean, lo: range.lo, hi: range.hi, n });
    const verdict = C.avalancheVerdict(d.count, n);
    const v = $('ava-verdict');
    v.className = `msg ${verdict === 'within' ? 'ok' : 'warn'}`;
    v.textContent = t(`ava.${verdict}`) + (verdict !== 'within' && algo !== 'ToyHash16' ? t('ui.sentenceSep') + t('ava.chance') : '');
    statsTable($('ava-stats-a'), da, t('ava.digestA'));
    statsTable($('ava-stats-b'), db, t('ava.digestB'));
    return undefined;
  }

  // 次・前のビット（バイトの終わりで次のバイトへ、入力の終わりで先頭へ）
  function stepBit(delta) {
    const parsed = C.parseInput($('ava-input').value, $('ava-format').value);
    if (!parsed.ok || !parsed.bytes.length) return;
    const total = parsed.bytes.length * 8;
    const byte = C.parseIndex($('ava-byte').value);
    const bit = C.parseIndex($('ava-bit').value);
    const valid = Number.isInteger(byte) && Number.isInteger(bit) && byte < parsed.bytes.length && bit < 8;
    const pos = valid ? byte * 8 + bit : -delta;
    const next = (((pos + delta) % total) + total) % total;
    $('ava-byte').value = String(Math.floor(next / 8));
    $('ava-bit').value = String(next % 8);
    renderAva();
  }
  $('ava-prev').addEventListener('click', () => stepBit(-1));
  $('ava-next').addEventListener('click', () => stepBit(1));
  $('ava-random').addEventListener('click', () => {
    const parsed = C.parseInput($('ava-input').value, $('ava-format').value);
    if (!parsed.ok || !parsed.bytes.length) return;
    const r = crypto.getRandomValues(new Uint32Array(1))[0] % (parsed.bytes.length * 8);
    $('ava-byte').value = String(Math.floor(r / 8));
    $('ava-bit').value = String(r % 8);
    renderAva();
  });
  for (const id of ['ava-input', 'ava-byte', 'ava-bit']) $(id).addEventListener('input', renderAva);
  for (const id of ['ava-format', 'ava-algo']) $(id).addEventListener('change', renderAva);

  // ===== 可視化 =====
  let vizSeq = 0;
  function vizFail(items) {
    show('viz-status', items);
    $('viz-result').hidden = true;
  }

  async function renderViz() {
    const seq = ++vizSeq;
    const algo = $('viz-algo').value;
    const parsed = C.parseInput($('viz-input').value, $('viz-format').value);
    if (!parsed.ok) return vizFail([errorItem(parsed)]);
    const r = await digestPair(algo, parsed.bytes, parsed.bytes);
    if (seq !== vizSeq) return undefined;
    if (!r.ok) return vizFail([errorItem(r)]);
    const [dg] = r.value;
    show('viz-status', []);
    $('viz-result').hidden = false;
    $('viz-hex').textContent = C.toHex(dg);
    const lines = [];
    for (let i = 0; i < dg.length; i += 8) lines.push(Array.from(dg.slice(i, i + 8), C.toBinary).join(' '));
    $('viz-binary').textContent = lines.join('\n');
    setBits(groups.viz, [C.bytesToBits(dg)], algo);
    statsTable($('viz-stats'), dg);
    return undefined;
  }
  $('viz-input').addEventListener('input', renderViz);
  for (const id of ['viz-format', 'viz-algo']) $(id).addEventListener('change', renderViz);

  // ===== 衝突 =====
  const sampleById = (id) => C.SAMPLES.find((s) => s.id === id);

  function renderSampleNote() {
    const s = sampleById($('col-sample').value);
    const items = [el('p', '', t(`note.${s.id}`))];
    if (s.sources.length) {
      const p = el('p', 'sources', t('col.sources'));
      s.sources.forEach((src, k) => {
        if (k) p.append(document.createTextNode(t('ui.listSep')));
        const a = el('a', '', src.label);
        a.href = src.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        p.append(a);
      });
      items.push(p);
    }
    $('col-note').replaceChildren(...items);
  }

  function loadSample() {
    const s = sampleById($('col-sample').value);
    const shown = (v) => (s.format === 'hex' ? C.formatHex(C.parseHex(v).bytes) : v);
    $('col-format').value = s.format;
    $('col-algo').value = s.algo;
    $('col-a').value = shown(s.a);
    $('col-b').value = shown(s.b);
    renderCol();
  }

  // バイトの並び（16バイトで改行、4バイトごとに空白）。違うバイトに印。長い入力は先頭だけ
  const DUMP_MAX = 1024;
  function dumpInto(node, bytes, diffs) {
    const parts = [];
    const n = Math.min(bytes.length, DUMP_MAX);
    for (let i = 0; i < n; i++) {
      if (i) parts.push(document.createTextNode(i % 16 === 0 ? '\n' : i % 4 === 0 ? ' ' : ''));
      parts.push(diffs.has(i) ? el('mark', 'chg', hex2(bytes[i])) : document.createTextNode(hex2(bytes[i])));
    }
    if (bytes.length > DUMP_MAX) parts.push(document.createTextNode('\n…'));
    node.replaceChildren(...parts);
  }

  let colSeq = 0;
  function colFail(items) {
    show('col-status', items);
    $('col-result').hidden = true;
  }

  async function renderCol() {
    const seq = ++colSeq;
    const format = $('col-format').value;
    const algo = $('col-algo').value;
    const a = C.parseInput($('col-a').value, format);
    const b = C.parseInput($('col-b').value, format);
    const errs = [];
    if (!a.ok) errs.push(errorItem(a, 'label.inputA'));
    if (!b.ok) errs.push(errorItem(b, 'label.inputB'));
    if (errs.length) return colFail(errs);
    const r = await digestPair(algo, a.bytes, b.bytes);
    let all = null;
    try {
      all = await C.compareAll(a.bytes, b.bytes);
    } catch {
      all = null;
    }
    if (seq !== colSeq) return undefined;
    if (!r.ok) return colFail([errorItem(r)]);
    show('col-status', []);
    $('col-result').hidden = false;
    const [da, db] = r.value;

    const diff = C.byteDiff(a.bytes, b.bytes);
    const pos = diff.positions;
    const identical = pos.length === 0;
    const list = pos.slice(0, 12).join(t('ui.listSep')) + (pos.length > 12 ? t('col.more', { rest: pos.length - 12 }) : '');
    let bytesText = t('col.bytesDiff', { len: diff.lengthA, count: pos.length, list });
    if (identical) bytesText = t('col.bytesSame');
    else if (diff.lengthA !== diff.lengthB) bytesText = t('col.bytesDiffLen', { a: diff.lengthA, b: diff.lengthB, count: pos.length });
    $('col-bytes').textContent = bytesText;
    const set = new Set(pos);
    dumpInto($('col-dump-a'), a.bytes, set);
    dumpInto($('col-dump-b'), b.bytes, set);

    const ha = C.toHex(da);
    const hb = C.toHex(db);
    hexInto($('col-hex-a'), ha);
    hexInto($('col-hex-b'), hb, ha);
    const v = $('col-verdict');
    if (identical) {
      v.className = 'badge info';
      v.textContent = t('col.bytesSame');
    } else {
      v.className = `badge ${ha === hb ? 'ok' : 'ng'}`;
      v.textContent = `${algo}${t('ui.colon')}${t(ha === hb ? 'col.same' : 'col.different')}`;
    }
    setBits(groups.col, [C.bytesToBits(da), C.bytesToBits(db)], algo);

    const rows = (all || []).map((x) => {
      const tr = el('tr');
      const th = el('th', 'mono', x.algo);
      th.scope = 'row';
      const same = x.same && !identical;
      tr.append(th, el('td', same ? 'ok-text' : '', t(same ? 'col.sameShort' : 'col.diffShort')));
      return tr;
    });
    $('col-all').replaceChildren(...rows);
    lastCol = { a: a.bytes, b: b.bytes, algo, identical, origSame: ha === hb };
    renderExt();
    return undefined;
  }
  $('col-sample').addEventListener('change', renderSampleNote);
  $('col-load').addEventListener('click', loadSample);
  for (const id of ['col-a', 'col-b']) $(id).addEventListener('input', renderCol);
  for (const id of ['col-format', 'col-algo']) $(id).addEventListener('change', renderCol);

  // ===== 同じデータを足す（Merkle–Damgård 構造） =====
  let lastCol = null;
  let extSeq = 0;

  // 内部状態の16進を語（MD5 は4語、SHA-1 は5語）に分けて書き、other と違う語に印を付ける
  function stateInto(node, hex, other, words) {
    if (!hex) {
      node.textContent = '-';
      return;
    }
    const parts = [];
    for (let i = 0; i < words; i++) {
      const w = hex.slice(i * 8, i * 8 + 8);
      if (i) parts.push(document.createTextNode(' '));
      parts.push(other && other.slice(i * 8, i * 8 + 8) !== w ? el('mark', 'chg', w) : document.createTextNode(w));
    }
    node.replaceChildren(...parts);
  }

  function ihvRow(row, words) {
    const tr = el('tr');
    const th = el('th', '', row.index ? t('ext.block', { i: row.index, from: row.from, to: row.to }) : t('ext.iv'));
    th.scope = 'row';
    if (row.inputDiffers) th.append(el('span', 'tag', t('ext.tagDiff')));
    if (row.padding) th.append(el('span', 'tag', t('ext.tagPad')));
    const ca = el('td', 'mono');
    const cb = el('td', 'mono');
    stateInto(ca, row.stateA, row.stateB, words);
    stateInto(cb, row.stateB, row.stateA, words);
    tr.append(th, ca, cb, el('td', row.same ? 'ok-text' : '', t(row.same ? 'ext.sameShort' : 'ext.diffShort')));
    return tr;
  }

  function omittedRow(n) {
    const tr = el('tr');
    const td = el('td', 'omitted', t('ext.omitted', { n }));
    td.colSpan = 4;
    tr.append(td);
    return tr;
  }

  async function renderExt() {
    const seq = ++extSeq;
    if (!lastCol) return;
    const { a, b, algo, identical, origSame } = lastCol;
    const where = $('ext-where').value;
    const extra = C.utf8($('ext-text').value);
    const added = where !== 'none' && extra.length > 0;
    const [ea, eb] = C.extendPair(a, b, extra, where);
    const r = await digestPair(algo, ea, eb);
    if (seq !== extSeq || !r.ok) return;
    const same = C.toHex(r.value[0]) === C.toHex(r.value[1]);
    const v = $('ext-verdict');
    if (identical) {
      v.className = 'badge info';
      v.textContent = t('col.bytesSame');
    } else {
      v.className = `badge ${same ? 'ok' : 'ng'}`;
      // 何も足していないときは、元の組の判定と同じ書き方にする
      v.textContent = added ? t(same ? 'ext.same' : 'ext.different', { algo }) : `${algo}${t('ui.colon')}${t(same ? 'col.same' : 'col.different')}`;
    }
    const chain = C.CHAIN_ALGOS.includes(algo) && !identical;
    $('ext-table').hidden = !chain;
    $('ext-none').hidden = C.CHAIN_ALGOS.includes(algo);
    const notes = [];
    if (!identical && !origSame) notes.push(t('ext.origNone', { algo }));
    else if (!identical && algo === 'ToyHash16') notes.push(t('ext.toyNote'));
    if (chain && origSame) {
      const o = C.chainCompare(algo, a, b);
      if (o.suffixSafe) notes.push(t('ext.origSafe', { j: o.converge }));
      else notes.push(t('ext.origPadding'));
    }
    if (chain) {
      const cmp = C.chainCompare(algo, ea, eb);
      const rows = cmp.rows.length > 17 ? [...cmp.rows.slice(0, 9), null, ...cmp.rows.slice(-4)] : cmp.rows;
      $('ext-ihv').replaceChildren(...rows.map((row) => (row ? ihvRow(row, cmp.words) : omittedRow(cmp.rows.length - 13))));
    } else {
      $('ext-ihv').replaceChildren();
    }
    if (where === 'prefix' && extra.length && chain && origSame) notes.push(t('ext.prefixNote'));
    $('ext-orig').textContent = notes.join(t('ui.sentenceSep'));
    $('ext-orig').hidden = !notes.length;
  }
  $('ext-where').addEventListener('change', renderExt);
  $('ext-text').addEventListener('input', renderExt);

  // ===== 誕生日攻撃 =====
  const bd = { running: false, stop: false, samples: [], last: null, n: 24, algo: 'SHA-256', progress: null, status: [] };
  const fmtNum = (x) => Math.round(x).toLocaleString(I.lang === 'ja' ? 'ja-JP' : 'en-US');

  function renderBdEstimate() {
    const n = Number($('bd-bits').value);
    const trials = Number($('bd-trials').value);
    const per = C.birthdayExpected(n);
    $('bd-estimate').textContent = t('bd.estimate', { per: fmtNum(per), trials, total: fmtNum(per * trials) });
  }

  function renderBdLimits() {
    $('bd-limits').replaceChildren(...C.BIRTHDAY_LIMITS.map((x) => {
      const tr = el('tr');
      const th = el('th', 'mono', x.algo);
      th.scope = 'row';
      tr.append(th, el('td', '', String(x.bits)), el('td', '', t('bd.pow', { e: x.birthday })),
        el('td', '', x.attack === null ? t('bd.attackNone') : t('bd.pow', { e: x.attack })));
      return tr;
    }));
  }

  function renderBdProgress() {
    $('bd-progress').textContent = bd.progress ? t('bd.progress', { ...bd.progress, tries: fmtNum(bd.progress.tries) }) : '';
  }

  // グラフの名前は今の言語で付け直す。描くのは見えているときだけ
  function drawChart() {
    if (!bd.samples.length) return;
    $('bd-chart').setAttribute('aria-label', t('bd.chartLabel', { n: bd.n, count: bd.samples.length }));
    if ($('panel-birthday').hidden || $('bd-result').hidden) return;
    D.cdfChart($('bd-chart'), bd.samples, bd.n, {
      x: t('bd.chartX'), y: t('bd.chartY'), theory: t('bd.legendTheory'), measured: t('bd.legendMeasured'), expected: t('bd.legendExpected'), fmt: fmtNum
    });
  }

  function bdStatsTable(s) {
    const table = el('table', 'stats-table');
    const tbody = el('tbody');
    for (const [key, value] of [['bd.count', s.count], ['bd.mean', s.mean], ['bd.median', s.median], ['bd.min', s.min], ['bd.max', s.max],
      ['bd.expected', s.expected]]) {
      const tr = el('tr');
      const th = el('th', '', t(key));
      th.scope = 'row';
      tr.append(th, el('td', 'mono', fmtNum(value)));
      tbody.append(tr);
    }
    table.append(tbody);
    $('bd-stats').replaceChildren(table);
  }

  async function renderBd() {
    if (!bd.samples.length || !bd.last) {
      $('bd-result').hidden = true;
      // 隠すときは前の結果を消す（言語を切り替えたあとに、前の言語の文が残らないように）
      for (const id of ['bd-pair-note', 'bd-col-digest', 'bd-summary']) $(id).textContent = '';
      for (const id of ['bd-pair', 'bd-stats']) $(id).replaceChildren();
      $('bd-chart').removeAttribute('aria-label');
      return;
    }
    const r = bd.last;
    const k = bd.n / 4;
    const [da, db] = await Promise.all([C.digest(bd.algo, C.utf8(r.a)), C.digest(bd.algo, C.utf8(r.b))]);
    const [ha, hb] = [C.toHex(da), C.toHex(db)];
    $('bd-result').hidden = false;
    $('bd-pair-note').textContent = t('bd.pairNote', { tries: fmtNum(r.tries), n: bd.n, hex: ha.slice(0, k) });
    $('bd-col-digest').textContent = t('bd.colDigest', { n: bd.n });
    $('bd-pair').replaceChildren(...[[r.a, ha], [r.b, hb]].map(([msg, hex]) => {
      const tr = el('tr');
      const th = el('th', 'mono', msg);
      th.scope = 'row';
      const td = el('td', 'mono hex-cell');
      td.append(el('mark', 'chg', hex.slice(0, k)), document.createTextNode(hex.slice(k)));
      tr.append(th, td);
      return tr;
    }));
    const s = C.birthdaySummary(bd.samples, bd.n);
    $('bd-summary').textContent = t('bd.summary', { mean: fmtNum(s.mean), expected: fmtNum(s.expected), ratio: s.ratio.toFixed(2) });
    bdStatsTable(s);
    drawChart();
  }

  function setBdRunning(on) {
    bd.running = on;
    $('bd-run').disabled = on;
    $('bd-stop').disabled = !on;
    for (const id of ['bd-algo', 'bd-bits', 'bd-trials']) $(id).disabled = on;
  }

  // 試行を順に行う。計算は小分けにし、30ms ごとにイベントを処理させる（止めるボタンが効くように）
  async function runBd() {
    if (bd.running) return;
    const algo = $('bd-algo').value;
    const n = Number($('bd-bits').value);
    const trials = Number($('bd-trials').value);
    Object.assign(bd, { stop: false, samples: [], last: null, n, algo, progress: null, status: [] });
    setBdRunning(true);
    show('bd-status', []);
    $('bd-result').hidden = true;
    const base = C.toHex(crypto.getRandomValues(new Uint8Array(4)));
    let lastYield = performance.now();
    let lastPaint = 0;
    const pause = () => {
      if (performance.now() - lastYield < 30) return null;
      lastYield = performance.now();
      return new Promise((resolve) => setTimeout(resolve, 0));
    };
    try {
      for (let i = 0; i < trials; i++) {
        const onProgress = (k) => {
          if (performance.now() - lastPaint < 150) return;
          lastPaint = performance.now();
          bd.progress = { trial: i + 1, trials, tries: k };
          renderBdProgress();
        };
        const r = await C.birthdaySearch({ algo, n, seed: `${base}${i}`, batch: 1024, onProgress, shouldStop: () => bd.stop, pause });
        if (!r) break;
        bd.samples.push(r.tries);
        bd.last = r;
        bd.progress = { trial: i + 1, trials, tries: r.tries };
        renderBdProgress();
        await renderBd();
      }
      bd.status = [{ key: bd.stop ? 'bd.stopped' : 'bd.done', vars: { count: bd.samples.length }, level: 'ok' }];
    } catch (e) {
      bd.status = [errorItem({ error: e && e.message === 'nosubtle' ? 'nosubtle' : 'empty' })];
    } finally {
      show('bd-status', bd.status);
      setBdRunning(false);
    }
  }
  $('bd-run').addEventListener('click', runBd);
  $('bd-stop').addEventListener('click', () => {
    bd.stop = true;
  });
  for (const id of ['bd-bits', 'bd-trials']) $(id).addEventListener('change', renderBdEstimate);

  // ===== 言語・テーマ =====
  function renderAll() {
    renderAva();
    renderViz();
    renderSampleNote();
    renderCol();
    renderBdEstimate();
    renderBdLimits();
    renderBdProgress();
    renderBd();
    if (!bd.running) show('bd-status', bd.status);
    for (const g of GROUPS) {
      g.syncControls();
      renderMarks(g);
    }
  }
  $('btn-lang').addEventListener('click', () => {
    I.set(I.lang === 'ja' ? 'en' : 'ja');
    I.applyStaticText();
    Theme.refresh($('btn-theme'));
    renderAll();
  });
  $('btn-theme').addEventListener('click', () => {
    Theme.toggle($('btn-theme'));
    GROUPS.forEach(redraw);
    drawChart();
  });
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      GROUPS.forEach(redraw);
      drawChart();
    });
  }

  // ===== 初期表示 =====
  I.init();
  I.applyStaticText();
  Theme.refresh($('btn-theme'));
  loadSample();
  renderAll();
})();
