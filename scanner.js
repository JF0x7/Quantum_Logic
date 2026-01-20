/* ---------------------------------------------------
   QTUM(LOG) Identity Ledger Module
   Handles:
   - Storing entries
   - Rendering entries
   - Emitting signals
--------------------------------------------------- */

let identityLedger = [];

// DOM references
const ledgerList = document.getElementById("ledgerList");
const clearLedgerBtn = document.getElementById("clearLedgerBtn");
const statusEl = document.getElementById("status");

/* Load ledger from localStorage */
function loadLedger() {
  const raw = localStorage.getItem("qtumlog_identity_ledger");
  identityLedger = raw ? JSON.parse(raw) : [];
  renderLedger();
}

/* Save ledger */
function saveLedger() {
  localStorage.setItem("qtumlog_identity_ledger", JSON.stringify(identityLedger));
}

/* Add new entry */
function addLedgerEntry({ data, source, isQtum }) {
  identityLedger.unshift({
    data,
    source,
    isQtum,
    ts: new Date().toISOString()
  });

  saveLedger();
  renderLedger();

  if (isQtum) emitSignal();
}

/* Render ledger entries */
function renderLedger() {
  ledgerList.innerHTML = "";

  if (identityLedger.length === 0) {
    ledgerList.innerHTML = `<div style="color:#6b7280;font-size:11px;">No identities recorded yet.</div>`;
    return;
  }

  identityLedger.forEach(entry => {
    const wrap = document.createElement("div");
    wrap.className = "ledger-entry" + (entry.isQtum ? " qtum" : "");

    wrap.innerHTML = `
      <div class="ledger-meta">
        <span class="ledger-type">${entry.isQtum ? "QTUM(LOG) SIGNAL" : "GENERIC QR"}</span>
        <span class="ledger-source">${entry.source.toUpperCase()}</span>
        <span class="ledger-time">${new Date(entry.ts).toLocaleTimeString()}</span>
      </div>
      <div class="ledger-data">${entry.data}</div>
    `;

    ledgerList.appendChild(wrap);
  });
}

/* Visual signal pulse */
function emitSignal() {
  statusEl.classList.add("signal");
  setTimeout(() => statusEl.classList.remove("signal"), 400);
}

/* Clear ledger */
clearLedgerBtn.onclick = () => {
  identityLedger = [];
  saveLedger();
  renderLedger();
  statusEl.textContent = "Local identity ledger cleared.";
};

// Initialize
loadLedger();
