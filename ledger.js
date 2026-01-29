const ledgerEl = document.getElementById("ledger");

function addToLedger(data) {
  const item = document.createElement("div");
  item.className = "ledgerItem";

  const payload = document.createElement("div");
  payload.className = "ledgerPayload";
  payload.textContent = data;

  const time = document.createElement("div");
  time.className = "ledgerTime";
  time.textContent = new Date().toLocaleString();

  item.appendChild(payload);
  item.appendChild(time);

  ledgerEl.prepend(item);
}
const tag = document.createElement("div");
tag.className = "ledgerTag";
tag.textContent = "JH Tools"; // or "Beler Verified", "Fairn Auth"
item.appendChild(tag);
