// ------------------------------
// 2D Canvas Drawing Functions
// ------------------------------

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
      ctx.fillStyle = v ? "#e9ecef" : "#212529";
      ctx.fillRect(offsetX + c*cell, offsetY + r*cell, cell-1, cell-1);
    }
  }
  
  // Draw selection marks
  drawSelectionMarks(ctx, cols, rows, cell, offsetX, offsetY, bits.length, canvas.id);
  
  // 3Dモードの場合は3D表示も更新
  update3DIfNeeded(canvas, bits);
}

// Draw selection marks on canvas
function drawSelectionMarks(ctx, cols, rows, cell, offsetX, offsetY, bitLength, canvasId) {
  ctx.strokeStyle = "#ff4444";
  ctx.lineWidth = 3;
  
  const canvasSelectedBits = selectedBits[canvasId] || new Set();
  
  for (const bitIndex of canvasSelectedBits) {
    if (bitIndex >= bitLength) continue;
    
    const r = Math.floor(bitIndex / cols);
    const c = bitIndex % cols;
    
    const x = offsetX + c * cell;
    const y = offsetY + r * cell;
    
    ctx.strokeRect(x, y, cell-1, cell-1);
  }
}

// Get bit index from click position on canvas
function getBitIndexFromClick(canvas, event, bits) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  
  // Scale coordinates to canvas size
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const canvasX = x * scaleX;
  const canvasY = y * scaleY;
  
  // Calculate grid dimensions (same logic as drawGrid)
  let cols, rows;
  if (bits.length === 512) {
    cols = 32; rows = 16;
  } else if (bits.length === 256) {
    cols = 16; rows = 16;
  } else if (bits.length === 160) {
    cols = 20; rows = 8;
  } else if (bits.length === 128) {
    cols = 16; rows = 8;
  } else if (bits.length === 16) {
    cols = 4; rows = 4;
  } else {
    cols = Math.ceil(Math.sqrt(bits.length));
    rows = Math.ceil(bits.length / cols);
  }
  
  const maxCellWidth = Math.floor(canvas.width / cols);
  const maxCellHeight = Math.floor(canvas.height / rows);
  const cell = Math.min(maxCellWidth, maxCellHeight);
  
  const gridWidth = cell * cols;
  const gridHeight = cell * rows;
  
  const offsetX = Math.floor((canvas.width - gridWidth) / 2);
  const offsetY = Math.floor((canvas.height - gridHeight) / 2);
  
  // Check if click is within grid bounds
  if (canvasX < offsetX || canvasX >= offsetX + gridWidth ||
      canvasY < offsetY || canvasY >= offsetY + gridHeight) {
    return -1; // Click outside grid
  }
  
  // Calculate cell coordinates
  const cellX = Math.floor((canvasX - offsetX) / cell);
  const cellY = Math.floor((canvasY - offsetY) / cell);
  
  // Convert to bit index
  const bitIndex = cellY * cols + cellX;
  
  return bitIndex < bits.length ? bitIndex : -1;
}

// Store bit data when drawing grid (modify existing drawGrid calls)
function drawGridWithTracking(canvas, bits) {
  canvasBitData.set(canvas.id, bits);
  drawGrid(canvas, bits);
}