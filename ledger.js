/* ---------------------------------------------------
   QTUM(LOG) THEME — Naomi Future Edition
--------------------------------------------------- */

body {
  margin: 0;
  padding: 20px;
  background: radial-gradient(circle at top, #020617 0, #000 55%);
  color: #e0f2fe;
  font-family: system-ui, sans-serif;
  text-align: center;
}

/* Titles */
h1 {
  margin: 6px 0 2px;
  font-size: 24px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #38bdf8;
  text-shadow: 0 0 14px #0ea5e9;
}

h2 {
  margin: 0 0 16px;
  font-size: 11px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #94a3b8;
}

/* Scanner Shell */
#scannerShell {
  max-width: 420px;
  margin: 0 auto 18px;
  padding: 14px;
  border-radius: 18px;
  background: #020617;
  border: 1px solid rgba(37, 99, 235, 0.7);
  box-shadow: 0 0 30px rgba(56, 189, 248, 0.25);
}

/* Video Wrapper */
#videoWrapper {
  position: relative;
  width: 100%;
  border-radius: 14px;
  overflow: hidden;
  background: #000;
}

#video {
  width: 100%;
  display: block;
}

/* Hidden canvas for decoding */
#canvas {
  display: none;
}

/* Buttons */
button {
  border: none;
  border-radius: 999px;
  padding: 9px 16px;
  font-size: 13px;
  cursor: pointer;
  background: linear-gradient(135deg, #1d4ed8, #22d3ee);
  color: #e0f2fe;
  box-shadow: 0 0 14px rgba(56, 189, 248, 0.7);
}

button.secondary {
  background: rgba(15, 23, 42, 0.95);
  border: 1px solid rgba(148, 163, 184, 0.7);
  box-shadow: none;
}

/* Output Box */
#output {
  margin-top: 14px;
  padding: 12px;
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.95);
  border: 1px solid rgba(30, 64, 175, 0.9);
  text-align: left;
}

/* Status Colors */
#status.valid { color: #4ade80; }
#status.invalid { color: #f97373; }
#status.neutral { color: #e0f2fe; }
#status.signal { text-shadow: 0 0 12px #22c55e; }

/* Ledger Shell */
#ledgerShell {
  max-width: 420px;
  margin: 0 auto;
  padding: 12px;
  border-radius: 16px;
  background: #020617;
  border: 1px solid rgba(30, 64, 175, 0.7);
}

/* Ledger Entries */
.ledger-entry {
  padding: 6px;
  border-radius: 8px;
  margin-bottom: 4px;
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(30, 64, 175, 0.6);
}

.ledger-entry.qtum {
  border-color: #22c55e;
  box-shadow: 0 0 10px rgba(34, 197, 94, 0.35);
}
