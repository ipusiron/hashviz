// ------------------------------
// Utility
// ------------------------------
const $ = (sel) => document.querySelector(sel);

// Input sanitization helper
function sanitizeInput(str) {
  if (typeof str !== 'string') return '';
  // Remove any control characters except tab, newline, carriage return
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

// Safe integer parsing with bounds
function safeParseInt(value, min, max, defaultVal) {
  const num = parseInt(value, 10);
  if (isNaN(num)) return defaultVal;
  if (num < min) return min;
  if (num > max) return max;
  return num;
}

function utf8Encode(str) {
  return new TextEncoder().encode(str);
}
function toHex(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}
function hexToBytes(hex) {
  const clean = hex.trim().replace(/^0x/, "").replace(/\s+/g, "");
  // Validate hex string
  if (!/^[0-9a-fA-F]*$/.test(clean)) {
    throw new Error("Invalid hex string");
  }
  if (clean.length % 2 !== 0) {
    console.error("Odd hex length:", clean.length, "hex:", clean);
    throw new Error("Hex length must be even (got " + clean.length + " characters)");
  }
  // Limit size to prevent memory issues (10MB)
  if (clean.length > 20000000) throw new Error("Input too large");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i*2, i*2+2), 16);
  return out;
}
function base64ToBytes(b64) {
  try {
    const clean = b64.trim();
    // Validate base64 string
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) {
      throw new Error("Invalid base64 string");
    }
    // Limit size to prevent memory issues (10MB after decoding)
    if (clean.length > 13333334) throw new Error("Input too large");
    const bin = atob(clean);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch (e) {
    throw new Error("Base64 decoding failed: " + e.message);
  }
}
function bytesToBits(bytes) {
  const bits = [];
  for (const b of bytes) {
    for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1);
  }
  return bits;
}
function countBitDiff(aBytes, bBytes) {
  let diff = 0;
  const len = Math.min(aBytes.length, bBytes.length);
  for (let i = 0; i < len; i++) {
    diff += ((aBytes[i] ^ bBytes[i]) >>> 0).toString(2).replace(/0/g, "").length;
  }
  return diff;
}

// Note: algoBitLength() is now imported from hash-engines.js

function drawGrid(canvas, bits) {
  const ctx = canvas.getContext("2d");
  
  // Calculate optimal grid dimensions based on bit count
  let cols, rows;
  if (bits.length === 512) {
    // SHA-512: 32x16 for better aspect ratio
    cols = 32;
    rows = 16;
  } else if (bits.length === 256) {
    // SHA-256: 16x16 square
    cols = 16;
    rows = 16;
  } else if (bits.length === 160) {
    // SHA-1: 20x8
    cols = 20;
    rows = 8;
  } else if (bits.length === 128) {
    // MD5: 16x8
    cols = 16;
    rows = 8;
  } else if (bits.length === 16) {
    // ToyHash16: 4x4
    cols = 4;
    rows = 4;
  } else {
    // Default: try to make it square-ish
    cols = Math.ceil(Math.sqrt(bits.length));
    rows = Math.ceil(bits.length / cols);
  }
  
  // Calculate cell size to fit within canvas
  const maxCellWidth = Math.floor(canvas.width / cols);
  const maxCellHeight = Math.floor(canvas.height / rows);
  const cell = Math.min(maxCellWidth, maxCellHeight); // Use full available space
  
  // Calculate actual grid size
  const gridWidth = cell * cols;
  const gridHeight = cell * rows;
  
  // Center the grid in the canvas
  const offsetX = Math.floor((canvas.width - gridWidth) / 2);
  const offsetY = Math.floor((canvas.height - gridHeight) / 2);
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fafafa";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const v = idx < bits.length ? bits[idx] : 0;
      ctx.fillStyle = v ? "#212529" : "#e9ecef";
      ctx.fillRect(offsetX + c*cell, offsetY + r*cell, cell-1, cell-1);
    }
  }
}

// ------------------------------
// Note: Hash engines have been moved to hash-engines.js
// The following functions are now imported from hash-engines.js:
// - algoBitLength(algo)
// - digest(algo, dataBytes) 
// ------------------------------

// ------------------------------
// Tabs
// ------------------------------
document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(b => b.classList.remove("is-active"));
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("is-active"));
    btn.classList.add("is-active");
    const id = btn.dataset.tab;
    $("#panel-" + id).classList.add("is-active");
  });
});

// ------------------------------
// Avalanche Demo
// ------------------------------
$("#ava-run").addEventListener("click", async () => {
  try {
    const algo = $("#ava-algo").value;
    const input = sanitizeInput($("#ava-input").value ?? "");
    
    // Limit input size
    if (input.length > 10000) {
      alert("入力が長すぎます（最大10000文字）");
      return;
    }
    
    const byteIdx = safeParseInt($("#ava-byte").value, 0, 9999, 0);
    const bitIdx = safeParseInt($("#ava-bit").value, 0, 7, 0);

    const a = utf8Encode(input);
    const b = new Uint8Array(a);
    if (byteIdx >= b.length) {
      alert(`バイト位置が範囲外です（0〜${Math.max(0, b.length-1)}）`);
      return;
    }
    if (bitIdx < 0 || bitIdx > 7) {
      alert("ビット位置は 0〜7 です");
      return;
    }
    b[byteIdx] = b[byteIdx] ^ (1 << bitIdx);

    const ha = await digest(algo, a);
    const hb = await digest(algo, b);

    $("#ava-hex-a").textContent = toHex(ha);
    $("#ava-hex-b").textContent = toHex(hb);

    const bitsA = bytesToBits(ha);
    const bitsB = bytesToBits(hb);
    drawGrid($("#ava-canvas-a"), bitsA);
    drawGrid($("#ava-canvas-b"), bitsB);

    const diff = countBitDiff(ha, hb);
    const total = algoBitLength(algo);
    $("#ava-diff-count").textContent = `${diff} / ${total}`;
    $("#ava-diff-rate").textContent = `${(diff / total * 100).toFixed(2)}%`;
  } catch (e) {
    console.error('Avalanche calculation error:', e);
    alert("計算エラーが発生しました");
  }
});

// ------------------------------
// Visualization
// ------------------------------
$("#viz-run").addEventListener("click", async () => {
  const algo = $("#viz-algo").value;
  const input = sanitizeInput($("#viz-input").value ?? "");
  
  // Limit input size
  if (input.length > 10000) {
    alert("入力が長すぎます（最大10000文字）");
    return;
  }
  try {
    const h = await digest(algo, utf8Encode(input));
    $("#viz-hex").textContent = toHex(h);
    drawGrid($("#viz-canvas"), bytesToBits(h));
  } catch (e) {
    console.error('Visualization error:', e);
    alert("計算エラーが発生しました");
  }
});

// ------------------------------
// Collision Demo
// ------------------------------
let collisionSamples = [];
(async function loadSamples() {
  try {
    const res = await fetch("./data/collisions.json");
    const json = await res.json();
    collisionSamples = json.pairs || [];
    console.log('Loaded collision samples:', collisionSamples.length);
  } catch (err) {
    console.warn('Failed to load collision samples from file, using fallback:', err);
    // Fallback data for local development
    collisionSamples = [
      {
        "id": "md5_wang_collision_1",
        "algo": "MD5",
        "label": "MD5 Wang et al. Collision (2004)",
        "encoding": "hex",
        "a": "d131dd02c5e6eec4693d9a0698aff95c2fcab58712467eab4004583eb8fb7f8955ad340609f4b30283e488832571415a085125e8f7cdc99fd91dbdf280373c5bd8",
        "b": "d131dd02c5e6eec4693d9a0698aff95c2fcab50712467eab4004583eb8fb7f8955ad340609f4b30283e4888325f1415a085125e8f7cdc99fd91dbd7280373c5bd8"
      },
      {
        "id": "toy16_collision_demo_1",
        "algo": "ToyHash16", 
        "label": "ToyHash16 Collision (sum mod 65536)",
        "encoding": "hex",
        "a": "4142",
        "b": "83"
      }
    ];
  }
  const sel = $("#col-sample");
  sel.innerHTML = "";
  if (collisionSamples.length === 0) {
    const opt = document.createElement("option");
    opt.textContent = "（サンプル未登録）";
    opt.value = "";
    sel.appendChild(opt);
  } else {
    for (const p of collisionSamples) {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = `${p.label} [${p.algo}]`;
      sel.appendChild(opt);
    }
  }
})();

function decodeByEncoding(text, enc) {
  if (enc === "base64") return base64ToBytes(text);
  if (enc === "hex") return hexToBytes(text);
  if (enc === "utf8") return utf8Encode(text);
  throw new Error("unknown encoding");
}

$("#col-load").addEventListener("click", () => {
  const id = $("#col-sample").value;
  console.log('Loading sample ID:', id);
  console.log('Available samples:', collisionSamples.map(x => x.id));
  
  if (!id) {
    alert("サンプルを選択してください。");
    return;
  }
  
  const s = collisionSamples.find(x => x.id === id);
  if (!s) {
    alert("選択されたサンプルが見つかりません。");
    console.error('Sample not found:', id);
    return;
  }
  
  console.log('Loading sample:', s);
  
  // Reset previous display state
  resetCollisionDisplay();
  
  const encoding = s.encoding || "base64";
  const algo = s.algo || "SHA-1";
  
  // Update hidden inputs for compatibility
  $("#col-encoding").value = encoding;
  $("#col-algo").value = algo;
  
  // Update display values
  $("#col-encoding-display").textContent = encoding;
  $("#col-algo-display").textContent = algo;
  
  $("#col-a").value = s.a || "";
  $("#col-b").value = s.b || "";
  $("#col-result").className = "badge";
  $("#col-result").textContent = "未計算";
  
  // Show difference information if available
  if (s.explanation || s.differences) {
    showDifferenceInfo(s);
  } else {
    $("#col-diff-info").style.display = "none";
  }
  
  // Update character-level diff display
  updateDiffDisplay();
  
  console.log('Sample loaded successfully');
});

// Reset collision display to clean state
function resetCollisionDisplay() {
  // Clear hash results
  $("#col-hex-a").textContent = "";
  $("#col-hex-b").textContent = "";
  
  // Clear canvas displays
  const canvasA = $("#col-canvas-a");
  const canvasB = $("#col-canvas-b");
  if (canvasA) {
    const ctxA = canvasA.getContext("2d");
    ctxA.clearRect(0, 0, canvasA.width, canvasA.height);
    ctxA.fillStyle = "#fafafa";
    ctxA.fillRect(0, 0, canvasA.width, canvasA.height);
  }
  if (canvasB) {
    const ctxB = canvasB.getContext("2d");
    ctxB.clearRect(0, 0, canvasB.width, canvasB.height);
    ctxB.fillStyle = "#fafafa";
    ctxB.fillRect(0, 0, canvasB.width, canvasB.height);
  }
  
  // Reset diff displays to textarea mode
  $("#col-a-display").style.display = "none";
  $("#col-b-display").style.display = "none";
  $("#col-a").style.display = "block";
  $("#col-b").style.display = "block";
  
  // Clear diff display content
  $("#col-a-display").innerHTML = "";
  $("#col-b-display").innerHTML = "";
  
  // Hide difference info initially
  $("#col-diff-info").style.display = "none";
  
  // Reset result badge
  $("#col-result").className = "badge";
  $("#col-result").textContent = "未計算";
}

// Show difference information
function showDifferenceInfo(sample) {
  const diffInfo = $("#col-diff-info");
  const explanation = $("#col-explanation");
  const differences = $("#col-differences");
  
  if (sample.explanation) {
    explanation.textContent = sample.explanation;
  } else {
    explanation.textContent = "";
  }
  
  if (sample.differences && sample.differences.length > 0) {
    differences.innerHTML = "";
    sample.differences.forEach((diff, idx) => {
      const diffItem = document.createElement("div");
      diffItem.className = "diff-item";
      diffItem.innerHTML = `
        <strong>位置 ${diff.pos}:</strong> 
        "${diff.a}" → "${diff.b}" 
        <span style="color: var(--muted); margin-left: 8px;">${diff.desc}</span>
      `;
      differences.appendChild(diffItem);
    });
  } else {
    differences.innerHTML = "";
  }
  
  diffInfo.style.display = "block";
}

// Show character-level differences
function showCharacterDiff() {
  const aText = $("#col-a").value.trim();
  const bText = $("#col-b").value.trim();
  
  const aDisplay = $("#col-a-display");
  const bDisplay = $("#col-b-display");
  
  if (!aText && !bText) {
    aDisplay.style.display = "none";
    bDisplay.style.display = "none";
    $("#col-a").style.display = "block";
    $("#col-b").style.display = "block";
    return;
  }
  
  if (aText && bText && aText !== bText) {
    // Show diff display, hide textareas
    aDisplay.style.display = "block";
    bDisplay.style.display = "block";
    $("#col-a").style.display = "none";
    $("#col-b").style.display = "none";
    
    // Generate character-level diff
    aDisplay.innerHTML = highlightCharDiff(aText, bText, 'a');
    bDisplay.innerHTML = highlightCharDiff(bText, aText, 'b');
  } else {
    // Show textareas, hide diff display
    aDisplay.style.display = "none";
    bDisplay.style.display = "none";
    $("#col-a").style.display = "block";
    $("#col-b").style.display = "block";
  }
}

function highlightCharDiff(text, otherText, side) {
  const maxLen = Math.max(text.length, otherText.length);
  let result = '';
  
  for (let i = 0; i < maxLen; i++) {
    const char = i < text.length ? text[i] : '';
    const otherChar = i < otherText.length ? otherText[i] : '';
    
    if (char !== otherChar) {
      if (char === '') {
        // Character missing in this text
        continue;
      } else {
        // Character differs
        result += `<span class="diff-char" title="Position ${i}: Different character">${escapeHtml(char)}</span>`;
      }
    } else {
      result += escapeHtml(char);
    }
  }
  
  return result;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Add event listeners for real-time character-level diff
$("#col-a").addEventListener("input", showCharacterDiff);
$("#col-b").addEventListener("input", showCharacterDiff);

// Also show diff when samples are loaded
function updateDiffDisplay() {
  setTimeout(showCharacterDiff, 100); // Small delay to ensure values are set
}

// Get currently selected sample ID
function getCurrentSampleId() {
  const selectElement = $("#col-sample");
  return selectElement ? selectElement.value : null;
}

// Add click handlers to switch back to edit mode
$("#col-a-display").addEventListener("click", () => {
  $("#col-a-display").style.display = "none";
  $("#col-a").style.display = "block";
  $("#col-a").focus();
});

$("#col-b-display").addEventListener("click", () => {
  $("#col-b-display").style.display = "none";
  $("#col-b").style.display = "block";
  $("#col-b").focus();
});

$("#col-run").addEventListener("click", async () => {
  console.log('Collision calculation started');
  
  const algo = $("#col-algo").value;
  const enc = $("#col-encoding").value;
  const aText = sanitizeInput($("#col-a").value).trim();
  const bText = sanitizeInput($("#col-b").value).trim();
  
  console.log(`Algorithm: ${algo}, Encoding: ${enc}`);
  console.log(`Input A: "${aText}" (${aText.length} chars)`);
  console.log(`Input B: "${bText}" (${bText.length} chars)`);
  
  // Limit input size
  if (aText.length > 100000 || bText.length > 100000) {
    alert("入力が長すぎます（最大100000文字）");
    return;
  }
  
  if (!aText || !bText) return alert("入力A/Bを指定してください。");

  try {
    console.log('Decoding inputs...');
    const aBytes = decodeByEncoding(aText, enc);
    const bBytes = decodeByEncoding(bText, enc);
    console.log(`Decoded A: [${Array.from(aBytes).join(', ')}]`);
    console.log(`Decoded B: [${Array.from(bBytes).join(', ')}]`);
    
    console.log('Computing hashes...');
    const ha = await digest(algo, aBytes);
    const hb = await digest(algo, bBytes);
    console.log(`Hash A: [${Array.from(ha).join(', ')}]`);
    console.log(`Hash B: [${Array.from(hb).join(', ')}]`);

    $("#col-hex-a").textContent = toHex(ha);
    $("#col-hex-b").textContent = toHex(hb);

    console.log('Drawing grids...');
    const bitsA = bytesToBits(ha);
    const bitsB = bytesToBits(hb);
    console.log(`Bits A: ${bitsA.length} bits`);
    console.log(`Bits B: ${bitsB.length} bits`);
    
    drawGrid($("#col-canvas-a"), bitsA);
    drawGrid($("#col-canvas-b"), bitsB);

    const hexA = toHex(ha);
    const hexB = toHex(hb);
    const same = (hexA === hexB);
    console.log(`Hash comparison: "${hexA}" === "${hexB}" ? ${same}`);
    
    const badge = $("#col-result");
    if (same) {
      badge.className = "badge ok";
      badge.textContent = "衝突確認！同じハッシュ値 ✅";
    } else {
      // Check if this is a demo/mock example
      const sampleId = getCurrentSampleId();
      const isDemoSample = sampleId && (sampleId.includes('demo') || sampleId.includes('wang') || sampleId.includes('flame') || sampleId.includes('shattered'));
      
      if (isDemoSample && algo !== 'ToyHash16') {
        badge.className = "badge ng";
        badge.textContent = "異なるハッシュ値（模擬例） ℹ️";
      } else {
        badge.className = "badge ng";
        badge.textContent = "異なるハッシュ値 ❌";
      }
    }
    
    console.log('Collision calculation completed');
  } catch (e) {
    console.error('Collision check error:', e);
    const badge = $("#col-result");
    badge.className = "badge ng";
    badge.textContent = "エラー ❌";
    alert("計算エラーが発生しました: " + e.message);
  }
});