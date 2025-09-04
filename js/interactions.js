// ------------------------------
// Canvas Click Handlers and Interactions
// ------------------------------

// Add click event listeners to all hash visualization canvases
function setupCanvasClickHandlers() {
  const canvases = [
    'ava-canvas-a', 'ava-canvas-b', 
    'viz-canvas', 
    'col-canvas-a', 'col-canvas-b'
  ];
  
  canvases.forEach(canvasId => {
    const canvas = $('#' + canvasId);
    if (canvas) {
      canvas.addEventListener('click', handleCanvasClick);
      canvas.style.cursor = 'pointer';
    }
  });
}

// Handle canvas click events
function handleCanvasClick(event) {
  const canvas = event.target;
  const bits = canvasBitData.get(canvas.id);
  
  if (!bits || bits.length === 0) return;
  
  const bitIndex = getBitIndexFromClick(canvas, event, bits);
  
  if (bitIndex >= 0) {
    const canvasSelectedBits = selectedBits[canvas.id] || new Set();
    
    // Toggle selection for this specific canvas
    if (canvasSelectedBits.has(bitIndex)) {
      canvasSelectedBits.delete(bitIndex);
    } else {
      canvasSelectedBits.add(bitIndex);
    }
    
    selectedBits[canvas.id] = canvasSelectedBits;
    
    // Check if this is an avalanche tab canvas - sync with its pair
    if (canvas.id === 'ava-canvas-a' || canvas.id === 'ava-canvas-b') {
      const pairCanvasId = canvas.id === 'ava-canvas-a' ? 'ava-canvas-b' : 'ava-canvas-a';
      
      // Sync selection with the paired canvas
      selectedBits[pairCanvasId] = new Set(canvasSelectedBits);
      
      // Redraw both canvases to update selection marks
      drawGrid(canvas, bits);
      const pairCanvas = $('#' + pairCanvasId);
      const pairBits = canvasBitData.get(pairCanvasId);
      if (pairCanvas && pairBits) {
        drawGrid(pairCanvas, pairBits);
      }
      
      // Update 3D for both canvases if needed
      update3DSelectionsForCanvas(canvas.id);
      update3DSelectionsForCanvas(pairCanvasId);
    } else {
      // For other tabs, only update the clicked canvas
      drawGrid(canvas, bits);
      update3DSelectionsForCanvas(canvas.id);
    }
  }
}

// ------------------------------
// Tab Management
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
// 3D Toggle Handlers
// ------------------------------

// 3D表示切り替え処理の設定
function setup3DToggles() {
  console.log('Setting up 3D toggles');
  
  // Check if toggle elements exist
  const avaToggle = $("#ava-toggle-3d");
  const vizToggle = $("#viz-toggle-3d");
  const colToggle = $("#col-toggle-3d");
  
  console.log('Toggle elements found:', !!avaToggle, !!vizToggle, !!colToggle);
  
  // アバランシェタブの3D切り替え
  if (avaToggle) {
    avaToggle.addEventListener("change", function() {
    console.log('Avalanche 3D toggle changed:', this.checked);
    const isChecked = this.checked;
    is3DMode.avalanche = isChecked;
    
    const containerA = $("#ava-3d-a").parentElement;
    const containerB = $("#ava-3d-b").parentElement;
    
    if (isChecked) {
      // 3Dモードに切り替え
      console.log('Adding show-3d class to containers');
      containerA.classList.add("show-3d");
      containerB.classList.add("show-3d");
      console.log('Container A classes:', containerA.classList.toString());
      console.log('Container B classes:', containerB.classList.toString());
      
      // 3Dシーンの初期化
      if (!scenes['ava-a']) {
        const sceneDataA = init3D("#ava-3d-a");
        if (sceneDataA) {
          scenes['ava-a'] = sceneDataA.scene;
          renderers['ava-a'] = sceneDataA.renderer;
          cameras['ava-a'] = sceneDataA.camera;
        }
      }
      
      if (!scenes['ava-b']) {
        const sceneDataB = init3D("#ava-3d-b");
        if (sceneDataB) {
          scenes['ava-b'] = sceneDataB.scene;
          renderers['ava-b'] = sceneDataB.renderer;
          cameras['ava-b'] = sceneDataB.camera;
        }
      }
      
      // 既存のデータがある場合は3D表示を更新
      const bitsA = canvasBitData.get('ava-canvas-a');
      const bitsB = canvasBitData.get('ava-canvas-b');
      
      if (bitsA && bitsA.length > 0) {
        create3DFromBits(bitsA, scenes['ava-a'], 'ava-canvas-a');
      } else {
        createPlaceholder3D(scenes['ava-a'], 256);
      }
      
      if (bitsB && bitsB.length > 0) {
        create3DFromBits(bitsB, scenes['ava-b'], 'ava-canvas-b');
      } else {
        createPlaceholder3D(scenes['ava-b'], 256);
      }
      
      // Initial render
      if (renderers['ava-a'] && scenes['ava-a'] && cameras['ava-a']) {
        renderers['ava-a'].render(scenes['ava-a'], cameras['ava-a']);
      }
      if (renderers['ava-b'] && scenes['ava-b'] && cameras['ava-b']) {
        renderers['ava-b'].render(scenes['ava-b'], cameras['ava-b']);
      }
    } else {
      // 2Dモードに戻す
      containerA.classList.remove("show-3d");
      containerB.classList.remove("show-3d");
    }
    });
  }

  // 可視化タブの3D切り替え
  if (vizToggle) {
    vizToggle.addEventListener("change", function() {
    console.log('Viz 3D toggle changed:', this.checked);
    const isChecked = this.checked;
    is3DMode.viz = isChecked;
    
    const container = $("#viz-3d").parentElement;
    
    if (isChecked) {
      container.classList.add("show-3d");
      
      if (!scenes['viz']) {
        const sceneData = init3D("#viz-3d");
        if (sceneData) {
          scenes['viz'] = sceneData.scene;
          renderers['viz'] = sceneData.renderer;
          cameras['viz'] = sceneData.camera;
        }
      }
      
      const bits = canvasBitData.get('viz-canvas');
      if (bits && bits.length > 0) {
        create3DFromBits(bits, scenes['viz'], 'viz-canvas');
      } else {
        createPlaceholder3D(scenes['viz'], 256);
      }
      
      // Initial render
      if (renderers['viz'] && scenes['viz'] && cameras['viz']) {
        renderers['viz'].render(scenes['viz'], cameras['viz']);
      }
    } else {
      container.classList.remove("show-3d");
    }
    });
  }

  // 衝突デモタブの3D切り替え
  if (colToggle) {
    colToggle.addEventListener("change", function() {
    console.log('Collision 3D toggle changed:', this.checked);
    const isChecked = this.checked;
    is3DMode.collision = isChecked;
    
    const containerA = $("#col-3d-a").parentElement;
    const containerB = $("#col-3d-b").parentElement;
    
    if (isChecked) {
      containerA.classList.add("show-3d");
      containerB.classList.add("show-3d");
      
      if (!scenes['col-a']) {
        const sceneDataA = init3D("#col-3d-a");
        if (sceneDataA) {
          scenes['col-a'] = sceneDataA.scene;
          renderers['col-a'] = sceneDataA.renderer;
          cameras['col-a'] = sceneDataA.camera;
        }
      }
      
      if (!scenes['col-b']) {
        const sceneDataB = init3D("#col-3d-b");
        if (sceneDataB) {
          scenes['col-b'] = sceneDataB.scene;
          renderers['col-b'] = sceneDataB.renderer;
          cameras['col-b'] = sceneDataB.camera;
        }
      }
      
      const bitsA = canvasBitData.get('col-canvas-a');
      const bitsB = canvasBitData.get('col-canvas-b');
      
      if (bitsA && bitsA.length > 0) {
        create3DFromBits(bitsA, scenes['col-a'], 'col-canvas-a');
      } else {
        createPlaceholder3D(scenes['col-a'], 256);
      }
      
      if (bitsB && bitsB.length > 0) {
        create3DFromBits(bitsB, scenes['col-b'], 'col-canvas-b');
      } else {
        createPlaceholder3D(scenes['col-b'], 256);
      }
    } else {
      containerA.classList.remove("show-3d");
      containerB.classList.remove("show-3d");
    }
    });
  }
  
  console.log('3D toggles setup completed');
}

// Initialize interactions
function initializeInteractions() {
  console.log('initializeInteractions called');
  setupCanvasClickHandlers();
  setup3DToggles();
  console.log('initializeInteractions completed');
}