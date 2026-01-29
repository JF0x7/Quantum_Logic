// ------------------------------
// QTUM(LOG) Identity Ledger
// ------------------------------

const LEDGER_KEY = "qtumlog_ledger";

// Safely load ledger from localStorage
function loadLedger() {
  try {
    const raw = localStorage.getItem(LEDGER_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error("Ledger load failed:", err);
    return [];
  }
}

// Save ledger to localStorage
function saveLedger(entries) {
  try {
    localStorage.setItem(LEDGER_KEY, JSON.stringify(entries));
  } catch (err) {
    console.error("Ledger save failed:", err);
  }
}

// Add a new entry
function addToLedger(payload) {
  if (!payload || typeof payload !== "string") {
    console.warn("Ignored invalid ledger payload:", payload);
    return;
  }

  const ledger = loadLedger();
  const entry = {
    payload: payload.trim(),
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

  if (!container) {
    console.error("Ledger container missing in DOM");
    return;
  }

  container.innerHTML = "";

  if (ledger.length === 0) {
    container.innerHTML = `<div class="empty">No identities logged yet…</div>`;
    return;
  }

  ledger.forEach(item => {
    const div = document.createElement("div");
    div.className = "ledgerItem";

    const payload = document.createElement("div");
    payload.className = "ledgerPayload";
    payload.textContent = item.payload;

    const time = document.createElement("div");
    time.className = "ledgerTime";
    time.textContent = new Date(item.timestamp).toLocaleString();

    div.appendChild(payload);
    div.appendChild(time);
    container.appendChild(div);
  });
}

// Clear ledger
const clearBtn = document.getElementById("clearLedgerBtn");
if (clearBtn) {
  clearBtn.addEventListener("click", () => {
    localStorage.removeItem(LEDGER_KEY);
    renderLedger();
  });
} else {
  console.error("Clear Ledger button missing in DOM");
}

// Initial render
document.addEventListener("DOMContentLoaded", renderLedger);
