const ledgerEl = document.getElementById("ledger");

// ------------------------------------------------------------
// ADD ENTRY TO LEDGER
// ------------------------------------------------------------
function addToLedger(data) {
  const item = document.createElement("div");
  item.className = "ledgerItem";

  const payload = document.createElement("div");
  payload.className = "ledgerPayload";
  payload.textContent = data;

  const time = document.createElement("div");
  time.className = "ledgerTime";
  time.textContent = new Date().toLocaleString();

  const tag = document.createElement("div");
  tag.className = "ledgerTag";
  tag.textContent = getFactionTag(data);

  const hidden = detectHiddenMessage(data);
  if (hidden) {
    const hiddenTag = document.createElement("div");
    hiddenTag.className = "ledgerTag";
    hiddenTag.style.color = "#2ea8ff";
    hiddenTag.textContent = `Hidden: ${hidden}`;
    item.appendChild(hiddenTag);
  }

  item.appendChild(payload);
  item.appendChild(time);
  item.appendChild(tag);

  ledgerEl.prepend(item);
}

// ------------------------------------------------------------
// FACTION TAGS
// ------------------------------------------------------------
function getFactionTag(data) {
  if (data.includes("JH")) return "JH Tools";
  if (data.includes("Beler")) return "Beler Verified";
  if (data.includes("Fairn")) return "Fairn Auth";
  return "Unmarked Scan";
}

// ------------------------------------------------------------
// HIDDEN MESSAGE DETECTION ENGINE
// ------------------------------------------------------------
function detectHiddenMessage(data) {
  // Base64 detection
  if (/^[A-Za-z0-9+/=]+$/.test(data) && data.length % 4 === 0) {
    try {
      atob(data);
      return "Base64";
    } catch {}
  }

  // Hexadecimal detection
  if (/^[0-9A-Fa-f]+$/.test(data) && data.length % 2 === 0) {
    return "Hexadecimal";
  }

  // ROT13 detection
  if (/^[A-Za-z]+$/.test(data)) {
    const rot = rot13(data);
    if (rot !== data) return "ROT13";
  }

  // Invisible Unicode (zero-width chars)
  if (/[\u200B-\u200F\uFEFF]/.test(data)) {
    return "Zero‑Width Unicode";
  }

  // Stego keywords
  const keywords = ["HIDDEN", "SECRET", "ENC", "MSG", "CRYPT"];
  for (const key of keywords) {
    if (data.toUpperCase().includes(key)) return "Keyword Flag";
  }

  return null;
}

// ------------------------------------------------------------
// ROT13 HELPER
// ------------------------------------------------------------
function rot13(str) {
  return str.replace(/[A-Za-z]/g, c =>
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
      .charAt(
        "NOPQRSTUVWXYZABCDEFGHIJKLMnopqrstuvwxyzabcdefghijklm"
          .indexOf(c)
      )
  );
}
