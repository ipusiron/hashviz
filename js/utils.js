// ------------------------------
// Utility Functions
// ------------------------------
const $ = (sel) => document.querySelector(sel);

// ------------------------------
// Global Variables
// ------------------------------

// Selected bit tracking - separate for each canvas
let selectedBits = {
  'ava-canvas-a': new Set(),
  'ava-canvas-b': new Set(),
  'viz-canvas': new Set(),
  'col-canvas-a': new Set(),
  'col-canvas-b': new Set()
};

// Track current bit data for each canvas
let canvasBitData = new Map();

// 3D rendering state management
let is3DMode = {
  avalanche: false,
  viz: false,
  collision: false
};

let scenes = {};
let renderers = {};
let cameras = {};

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
    // Limit size to prevent memory issues (10MB)
    if (clean.length > 13333334) throw new Error("Input too large");
    const binaryString = atob(clean);
    const out = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) out[i] = binaryString.charCodeAt(i);
    return out;
  } catch (e) {
    throw new Error(`Base64 decode error: ${e.message}`);
  }
}

function bytesToBits(bytes) {
  const bits = [];
  for (const byte of bytes) {
    for (let i = 7; i >= 0; i--) bits.push((byte >> i) & 1);
  }
  return bits;
}

function countBitDiff(a, b) {
  if (a.length !== b.length) return -1;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    let xor = a[i] ^ b[i];
    while (xor) { diff++; xor &= xor - 1; }
  }
  return diff;
}