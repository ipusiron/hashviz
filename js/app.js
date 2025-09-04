// ------------------------------
// Main Application Logic
// ------------------------------

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

    // Clear previous selections for avalanche canvases
    selectedBits['ava-canvas-a'] = new Set();
    selectedBits['ava-canvas-b'] = new Set();
    
    const bitsA = bytesToBits(ha);
    const bitsB = bytesToBits(hb);
    drawGridWithTracking($("#ava-canvas-a"), bitsA);
    drawGridWithTracking($("#ava-canvas-b"), bitsB);

    const diff = countBitDiff(ha, hb);
    const total = algoBitLength(algo);
    $("#ava-diff-count").textContent = `${diff} / ${total}`;
    $("#ava-diff-rate").textContent = `${(diff / total * 100).toFixed(2)}%`;

    // Update statistics
    const statsA = calculateHashStatistics(ha, bitsA);
    const statsB = calculateHashStatistics(hb, bitsB);
    displayStatistics(statsA, "#ava-stats-a");
    displayStatistics(statsB, "#ava-stats-b");
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
    // Clear previous selections for visualization canvas
    selectedBits['viz-canvas'] = new Set();
    
    const h = await digest(algo, utf8Encode(input));
    const bits = bytesToBits(h);
    $("#viz-hex").textContent = toHex(h);
    drawGridWithTracking($("#viz-canvas"), bits);

    // Update statistics
    const stats = calculateHashStatistics(h, bits);
    displayStatistics(stats, "#viz-stats");
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
      opt.textContent = p.label || `${p.algo} collision`;
      sel.appendChild(opt);
    }
  }
})();

function decodeInput(text, enc) {
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
    alert("サンプルが見つかりません。");
    return;
  }
  
  // データをUIに設定
  $("#col-a").value = s.a || "";
  $("#col-b").value = s.b || "";
  $("#col-encoding").value = s.encoding || "hex";
  $("#col-algo").value = s.algo || "SHA-1";
  
  // 表示用の値も更新
  $("#col-encoding-display").textContent = s.encoding || "hex";
  $("#col-algo-display").textContent = s.algo || "SHA-1";
  
  // 入力内容を表示エリアに反映し、差異を表示
  showInputDifferences(s.a || "", s.b || "", s.encoding || "hex");
  
  console.log('Sample loaded:', s);
});

function showInputDifferences(inputA, inputB, encoding) {
  try {
    const bytesA = decodeInput(inputA, encoding);
    const bytesB = decodeInput(inputB, encoding);
    
    // テキストエリアを非表示にして、差異表示エリアを表示
    $("#col-a").style.display = "none";
    $("#col-b").style.display = "none";
    $("#col-a-display").style.display = "block";
    $("#col-b-display").style.display = "block";
    $("#col-diff-info").style.display = "block";
    
    // 16進表示で差異をハイライト
    let displayA = "";
    let displayB = "";
    let differences = [];
    
    const maxLen = Math.max(bytesA.length, bytesB.length);
    for (let i = 0; i < maxLen; i++) {
      const byteA = i < bytesA.length ? bytesA[i] : undefined;
      const byteB = i < bytesB.length ? bytesB[i] : undefined;
      
      const hexA = byteA !== undefined ? byteA.toString(16).padStart(2, '0') : '--';
      const hexB = byteB !== undefined ? byteB.toString(16).padStart(2, '0') : '--';
      
      if (byteA !== byteB) {
        displayA += `<span class="diff-char">${hexA}</span>`;
        displayB += `<span class="diff-char">${hexB}</span>`;
        differences.push({
          position: i,
          valueA: hexA,
          valueB: hexB
        });
      } else {
        displayA += hexA;
        displayB += hexB;
      }
      
      // スペース区切り
      if ((i + 1) % 16 === 0) {
        displayA += '\n';
        displayB += '\n';
      } else if ((i + 1) % 4 === 0) {
        displayA += ' ';
        displayB += ' ';
      }
    }
    
    $("#col-a-display").innerHTML = displayA;
    $("#col-b-display").innerHTML = displayB;
    
    // 差異情報を表示
    const diffCount = differences.length;
    const totalBytes = maxLen;
    const diffPercentage = ((diffCount / totalBytes) * 100).toFixed(2);
    
    $("#col-explanation").textContent = 
      `入力データは${totalBytes}バイト中${diffCount}バイト（${diffPercentage}%）が異なります。`;
    
    // 差異の詳細（最初の5つまで表示）
    let diffDetails = "";
    const displayLimit = Math.min(differences.length, 5);
    for (let i = 0; i < displayLimit; i++) {
      const diff = differences[i];
      diffDetails += `<div class="diff-item">バイト${diff.position}: 0x${diff.valueA} → 0x${diff.valueB}</div>`;
    }
    if (differences.length > 5) {
      diffDetails += `<div class="diff-item">...他${differences.length - 5}箇所</div>`;
    }
    
    $("#col-differences").innerHTML = diffDetails;
    
  } catch (error) {
    console.error('Error showing differences:', error);
    $("#col-explanation").textContent = "入力データの解析中にエラーが発生しました。";
  }
}

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
  
  if (!aText || !bText) {
    alert("入力AとBの両方を入力してください。");
    return;
  }
  
  try {
    console.log('Decoding inputs...');
    const a = decodeInput(aText, enc);
    const b = decodeInput(bText, enc);
    console.log(`Decoded A: ${a.length} bytes`);
    console.log(`Decoded B: ${b.length} bytes`);
    
    console.log('Computing hashes...');
    const ha = await digest(algo, a);
    const hb = await digest(algo, b);
    console.log(`Hash A computed: ${ha.length} bytes`);
    console.log(`Hash B computed: ${hb.length} bytes`);
    
    $("#col-hex-a").textContent = toHex(ha);
    $("#col-hex-b").textContent = toHex(hb);

    console.log('Drawing grids...');
    const bitsA = bytesToBits(ha);
    const bitsB = bytesToBits(hb);
    console.log(`Bits A: ${bitsA.length} bits`);
    console.log(`Bits B: ${bitsB.length} bits`);
    
    // Clear previous selections for collision canvases
    selectedBits['col-canvas-a'] = new Set();
    selectedBits['col-canvas-b'] = new Set();
    
    drawGridWithTracking($("#col-canvas-a"), bitsA);
    drawGridWithTracking($("#col-canvas-b"), bitsB);

    // Update statistics
    const statsA = calculateHashStatistics(ha, bitsA);
    const statsB = calculateHashStatistics(hb, bitsB);
    displayStatistics(statsA, "#col-stats-a");
    displayStatistics(statsB, "#col-stats-b");

    const hexA = toHex(ha);
    const hexB = toHex(hb);
    const same = (hexA === hexB);
    console.log(`Hash comparison: "${hexA}" === "${hexB}" ? ${same}`);
    
    const badge = $("#col-result");
    if (same) {
      badge.className = "badge ok";
      badge.textContent = "衝突確認！同じハッシュ値 ✅";
    } else {
      badge.className = "badge ng";
      badge.textContent = "衝突なし（異なるハッシュ値）";
    }
    
    console.log('Collision calculation completed');
    
  } catch (e) {
    console.error('Collision calculation error:', e);
    alert(`計算エラー: ${e.message}`);
  }
});

// ------------------------------
// Application Initialization
// ------------------------------
// Initialize immediately since scripts are loaded after DOM
initializeInteractions();