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

  const tag = document.createElement("div");
  tag.className = "ledgerTag";
  tag.textContent = getFactionTag(data);

  item.appendChild(payload);
  item.appendChild(time);
  item.appendChild(tag);

  ledgerEl.prepend(item);
}

function getFactionTag(data) {
  if (data.includes("JH")) return "JH Tools";
  if (data.includes("Beler")) return "Beler Verified";
  if (data.includes("Fairn")) return "Fairn Auth";
  return "Unmarked Scan";
}
