// ------------------------------
// QTUM(LOG) Identity Ledger
// ------------------------------

const LEDGER_KEY = "qtumlog_ledger";

// Load ledger from localStorage
function loadLedger() {
  const raw = localStorage.getItem(LEDGER_KEY);
  return raw ? JSON.parse(raw) : [];
}

// Save ledger to localStorage
function saveLedger(entries) {
  localStorage.setItem(LEDGER_KEY, JSON.stringify(entries));
}

// Add a new entry
function addToLedger(payload) {
  const ledger = loadLedger();
  const entry = {
    payload,
    timestamp: new Date().toISOString()
  };
  ledger.unshift(entry);
  saveLedger(ledger);
  renderLedger();
}

// Render ledger list
function renderLedger() {
  const ledger = loadLedger();
  const container = document.getElementById("ledgerList");
  container.innerHTML = "";

  if (ledger.length === 0) {
    container.innerHTML = `<div class="empty">No identities logged yet…</div>`;
    return;
  }

  ledger.forEach(item => {
    const div = document.createElement("div");
    div.className = "ledgerItem";
    div.innerHTML = `
      <div class="ledgerPayload">${item.payload}</div>
      <div class="ledgerTime">${new Date(item.timestamp).toLocaleString()}</div>
    `;
    container.appendChild(div);
  });
}

// Clear ledger
document.getElementById("clearLedgerBtn").addEventListener("click", () => {
  localStorage.removeItem(LEDGER_KEY);
  renderLedger();
});

// Initial render
renderLedger();
