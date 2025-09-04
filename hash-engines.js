// ------------------------------
// Hash Engines Module
// ------------------------------

// Get bit length for each algorithm
function algoBitLength(algo) {
  switch (algo) {
    case "SHA-1": return 160;
    case "SHA-256": return 256;
    case "SHA-512": return 512;
    case "MD5": return 128;
    case "ToyHash16": return 16; // 2 bytes = 16 bits
    default: return 256;
  }
}

// MD5 implementation using js-md5 library
function md5Bytes(dataBytes) {
  // Convert Uint8Array to string for js-md5 library
  const str = Array.from(dataBytes).map(b => String.fromCharCode(b)).join('');
  const hexHash = md5(str);
  
  // Convert hex string back to Uint8Array
  const result = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    result[i] = parseInt(hexHash.substr(i * 2, 2), 16);
  }
  return result;
}

// ToyHash16 - Educational hash function for collision demo only
function toyHash16(bytes) {
  let sum = 0;
  for (const b of bytes) sum = (sum + b) & 0xFFFF;
  // 16bit -> 2byteのダイジェストとして返す
  return new Uint8Array([ (sum >>> 8) & 0xFF, sum & 0xFF ]);
}

// Main digest function
async function digest(algo, dataBytes) {
  if (algo === "MD5") {
    return md5Bytes(dataBytes);
  }
  if (algo === "ToyHash16") {
    return toyHash16(dataBytes);
  }
  const name = algo; // "SHA-1", "SHA-256", "SHA-512"
  const buf = await crypto.subtle.digest(name, dataBytes);
  return new Uint8Array(buf);
}