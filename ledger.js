const ledgerEl = document.getElementById("ledger");

/* ----------------------------------------------------------
   ADD TO LEDGER (UPGRADED)
---------------------------------------------------------- */
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
    hiddenTag.textContent = `Decrypted: ${hidden.type}`;
    
    const hiddenPayload = document.createElement("div");
    hiddenPayload.className = "ledgerPayload";
    hiddenPayload.textContent = hidden.decoded;

    item.appendChild(hiddenTag);
    item.appendChild(hiddenPayload);
  }

  item.appendChild(payload);
  item.appendChild(time);
  item.appendChild(tag);

  ledgerEl.prepend(item);
}

/* ----------------------------------------------------------
   FACTION TAGGING (CLEANER)
---------------------------------------------------------- */
function getFactionTag(data) {
  const factions = [
    { key: "JH", tag: "JH Tools" },
    { key: "Beler", tag: "Beler Verified" },
    { key: "Fairn", tag: "Fairn Auth" },
    { key: "[SIGNAL]", tag: "Signal Dispatch" }
  ];

  for (const f of factions) {
    if (data.includes(f.key)) return f.tag;
  }

  return "Unmarked Scan";
}

/* ----------------------------------------------------------
   HIDDEN MESSAGE DETECTION + DECRYPTION
---------------------------------------------------------- */
function detectHiddenMessage(data) {
  // 1. Base64
  if (/^[A-Za-z0-9+/=]+$/.test(data) && data.length % 4 === 0) {
    try {
      const decoded = atob(data);
      if (isReadable(decoded)) {
        return { type: "Base64", decoded };
      }
    } catch {}
  }

  // 2. Hex
  if (/^[0-9A-Fa-f]+$/.test(data) && data.length % 2 === 0) {
    try {
      const decoded = hexToString(data);
      if (isReadable(decoded)) {
        return { type: "Hex", decoded };
      }
    } catch {}
  }

  // 3. ROT13
  const rot = rot13(data);
  if (isReadable(rot) && rot !== data) {
    return { type: "ROT13", decoded: rot };
  }

  // 4. Embedded {msg:...}
  const match = data.match(/\{msg:(.*?)\}/);
  if (match) {
    return { type: "Embedded", decoded: match[1] };
  }

  return null;
}

/* ----------------------------------------------------------
   HELPERS
---------------------------------------------------------- */
function hexToString(hex) {
  let str = "";
  for (let i = 0; i < hex.length; i += 2) {
    str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
  }
  return str;
}

function rot13(str) {
  return str.replace(/[A-Za-z]/g, c =>
    "NOPQRSTUVWXYZABCDEFGHIJKLMnopqrstuvwxyzabcdefghijklm"[
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".indexOf(c)
    ]
  );
}

function isReadable(str) {
  return /[A-Za-z0-9 .,!?'"()]/.test(str);
}
