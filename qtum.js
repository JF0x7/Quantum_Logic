// Deep link to Qtum wallet
function sendQtum(address) {
  window.location.href = `qtum:${address}`;
}

// Placeholder generator (we can upgrade this to real keypair generation)
function generateQtumAddress() {
  const fake = "Q" + Math.random().toString(36).substring(2, 34);
  return fake;
}
