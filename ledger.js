/* ----------------------------------------------------------
   LEDGER — Quantum Archive with Decryption Layer
---------------------------------------------------------- */

/**
 * Analyze payload and extract metadata.
 * This simulates a "decryption" layer without doing anything unsafe.
 */
function analyzePayload(payload) {
  const length = payload.length;
  const entropy = calculateEntropy(payload);
  const isURL = /^https?:\/\//i.test(payload);
  const isJSON = payload.trim().startsWith("{") && payload.trim().endsWith("}");
  const isHex = /^[0-9a-fA-F]+$/.test(payload);
  const isBase64 = /^[A-Za-z0-9+/=]+$/.test(payload) && payload.length % 4 === 0;

  let classification = "UNKNOWN SIGNAL";

  if (isURL) classification = "URL";
  else if (isJSON) classification = "JSON OBJECT";
  else if (isHex) classification = "HEX STRING";
  else if (isBase64) classification = "BASE64 ENCODED";
  else if (length < 8) classification = "SHORT CODE";
  else if (length > 80) classification = "LONG FORM DATA";

  return {
    length,
    entropy,
    classification
  };
}

/**
 * Shannon entropy approximation
 */
function calculateEntropy(str) {
  const map = {};
  for (const char of str) {
    map[char] = (map[char] || 0) + 1;
  }

  let entropy = 0;
  const len = str.length;

  for (const char in map) {
    const p = map[char] / len;
    entropy -= p * Math.log2(p);
  }

  return entropy.toFixed(2);
}

/**
 * Add entry to ledger with metadata + decryption layer
 */
function addToLedger(payload, tag = "SCAN") {
  const ledger = document.getElementById("ledger");
  if (!ledger) return;

  const meta = analyzePayload(payload);
  const time = new Date().toLocaleString();

  const item = document.createElement("div");
  item.className = "ledgerItem";

  item.innerHTML = `
    <div class="ledgerPayload">${payload}</div>

    <div class="ledgerTime">${time}</div>

    <div class="ledgerTag">${tag}</div>

    <div class="ledgerMeta">
      <strong>Length:</strong> ${meta.length}<br>
      <strong>Entropy:</strong> ${meta.entropy}<br>
      <strong>Classification:</strong> ${meta.classification}
    </div>
  `;

  ledger.prepend(item);
}
