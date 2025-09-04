// ------------------------------
// Hash Statistics Functions
// ------------------------------

// Calculate hash statistics
function calculateHashStatistics(hashBytes, bits) {
  const total = bits.length;
  const ones = bits.reduce((sum, bit) => sum + bit, 0);
  const zeros = total - ones;
  const onesPercentage = ((ones / total) * 100).toFixed(2);
  const zerosPercentage = ((zeros / total) * 100).toFixed(2);
  
  // Calculate entropy (Shannon entropy)
  const p1 = ones / total;
  const p0 = zeros / total;
  let entropy = 0;
  if (p1 > 0) entropy -= p1 * Math.log2(p1);
  if (p0 > 0) entropy -= p0 * Math.log2(p0);
  
  // Calculate runs (consecutive sequences of same bit)
  let runs = 0;
  let currentRun = 1;
  let maxRun = 1;
  let runs1 = 0;
  let runs0 = 0;
  
  for (let i = 1; i < bits.length; i++) {
    if (bits[i] === bits[i-1]) {
      currentRun++;
    } else {
      if (bits[i-1] === 1) runs1++;
      else runs0++;
      maxRun = Math.max(maxRun, currentRun);
      currentRun = 1;
      runs++;
    }
  }
  if (bits.length > 0) {
    if (bits[bits.length-1] === 1) runs1++;
    else runs0++;
    maxRun = Math.max(maxRun, currentRun);
    runs++;
  }
  
  // Calculate byte distribution
  const byteFreq = new Array(256).fill(0);
  for (const byte of hashBytes) {
    byteFreq[byte]++;
  }
  const uniqueBytes = byteFreq.filter(f => f > 0).length;
  
  return {
    totalBits: total,
    ones: ones,
    zeros: zeros,
    onesPercentage: onesPercentage,
    zerosPercentage: zerosPercentage,
    entropy: entropy.toFixed(4),
    runs: runs,
    maxRun: maxRun,
    runs1: runs1,
    runs0: runs0,
    totalBytes: hashBytes.length,
    uniqueBytes: uniqueBytes,
    hexLength: hashBytes.length * 2
  };
}

// Display statistics in HTML table format
function displayStatistics(stats, containerId) {
  const container = $(containerId);
  if (!container) return;
  
  container.innerHTML = `
    <table class="stats-table-content">
      <tr><td>総ビット数</td><td>${stats.totalBits}</td></tr>
      <tr><td>1の個数</td><td>${stats.ones} (${stats.onesPercentage}%)</td></tr>
      <tr><td>0の個数</td><td>${stats.zeros} (${stats.zerosPercentage}%)</td></tr>
      <tr><td>エントロピー</td><td>${stats.entropy}</td></tr>
      <tr><td>連続数 (runs)</td><td>${stats.runs}</td></tr>
      <tr><td>最長連続</td><td>${stats.maxRun}</td></tr>
      <tr><td>1の連続数</td><td>${stats.runs1}</td></tr>
      <tr><td>0の連続数</td><td>${stats.runs0}</td></tr>
      <tr><td>バイト数</td><td>${stats.totalBytes}</td></tr>
      <tr><td>ユニークバイト数</td><td>${stats.uniqueBytes}/256</td></tr>
      <tr><td>16進長</td><td>${stats.hexLength}文字</td></tr>
    </table>
  `;
}