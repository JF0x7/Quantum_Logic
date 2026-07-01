/**
 * Quantum Scanner Engine — ZXing + QAI + Ledger
 */

const CONFIG = {
  cooldown: 2000,
  vibrate: true,
  autoRedirect: true,
  beep: { freq: 950, volume: 0.08, duration: 0.10 }
};

const state = {
  deviceId: null,
  devices: [],
  reader: null,
  cooldown: false,
  lastScan: null,
  ready: false
};

const el = {
  video: document.getElementById("video"),
  payload: document.getElementById("payload"),
  status: document.getElementById("status"),
  start: document.getElementById("startBtn"),
  flip: document.getElementById("flipBtn"),
  upload: document.getElementById("uploadBtn"),
  send: document.getElementById("sendBtn"),
  photo: document.getElementById("photoBtn"),
  resetLedger: document.getElementById("resetLedgerBtn"),
  fileInput: document.getElementById("fileInput"),
  canvas: document.getElementById("canvas"),
  photoPreview: document.getElementById("photoPreview")
};

const ledger = new QuantumLedger("ledger");
const brain = new Qai();

function setStatus(msg, type = "neutral") {
  if (el.status) {
    el.status.textContent = `Status: ${msg}`;
    el.status.classList.remove("neutral", "success", "error");
    el.status.classList.add(type);
  }
  console.log(`[Scanner] ${msg}`);
}

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.frequency.value = CONFIG.beep.freq;
    gain.gain.value = CONFIG.beep.volume;

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + CONFIG.beep.duration);

    setTimeout(() => ctx.close(), 300);
  } catch (_) {}
}

async function init() {
  if (typeof ZXing === "undefined") {
    setStatus("ZXing missing", "error");
    return;
  }

  const hints = new Map();
  hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
  hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
    ZXing.BarcodeFormat.QR_CODE,
    ZXing.BarcodeFormat.DATA_MATRIX,
    ZXing.BarcodeFormat.EAN_13,
    ZXing.BarcodeFormat.EAN_8,
    ZXing.BarcodeFormat.UPC_A,
    ZXing.BarcodeFormat.CODE_128,
    ZXing.BarcodeFormat.CODE_39,
    ZXing.BarcodeFormat.PDF_417,
    ZXing.BarcodeFormat.AZTEC,
    ZXing.BarcodeFormat.ITF,
    ZXing.BarcodeFormat.CODABAR
  ]);

  state.reader = new ZXing.BrowserMultiFormatReader(hints);
  state.ready = true;

  if (el.video) {
    Object.assign(el.video, { autoplay: true, playsinline: true, muted: true });
  }

  bindEvents();
  setStatus("Ready", "neutral");
}

async function start() {
  if (!state.ready) return setStatus("Not ready", "error");

  setStatus("Starting…", "neutral");
  state.reader.reset();

  const devices = await state.reader.listVideoInputDevices();
  state.devices = devices;

  if (!devices.length) return setStatus("No camera", "error");

  if (!state.deviceId) {
    const rear = devices.find(d => /back|rear|environment/i.test(d.label));
    state.deviceId = rear ? rear.deviceId : devices[0].deviceId;
  }

  const constraints = {
    video: {
      deviceId: { exact: state.deviceId },
      facingMode: "environment",
      width: { ideal: 1280, max: 1920 },
      height: { ideal: 720, max: 1080 },
      frameRate: { ideal: 30 }
    }
  };

  state.reader.decodeFromConstraints(constraints, el.video, (result, err) => {
    if (result) handleScan(result.getText());
    if (err && !(err instanceof ZXing.NotFoundException)) {
      console.debug(err);
    }
  });

  setStatus("Scanning…", "neutral");
}

function flip() {
  if (state.devices.length < 2) return setStatus("Only one camera", "error");

  const idx = state.devices.findIndex(d => d.deviceId === state.deviceId);
  state.deviceId = state.devices[(idx + 1) % state.devices.length].deviceId;
  setStatus("Swapping…", "neutral");
  start();
}

function stop() {
  state.reader?.reset();
  setStatus("Stopped", "neutral");
}

async function handleScan(data) {
  if (state.cooldown && data === state.lastScan) return;

  state.lastScan = data;
  state.cooldown = true;

  if (el.payload) el.payload.textContent = data;
  setStatus("Decoded!", "success");

  beep();
  if (CONFIG.vibrate && navigator.vibrate) navigator.vibrate(80);

  try {
    const analysis = await brain.process(data);
    ledger.addEntry(data, "SCAN", {
      type: analysis.format ? `${analysis.format.name} (${analysis.format.type})` : analysis.type,
      pattern: analysis.pattern,
      explanation: analysis.explanation
    });
  } catch (e) {
    console.warn("QAI error", e);
    ledger.addEntry(data, "SCAN");
  }

  if (CONFIG.autoRedirect) {
    const isUrl = /^https?:\/\/[^\s]+/i.test(data);
    const url = isUrl ? data : `https://www.google.com/search?q=${encodeURIComponent(data)}`;
    window.open(url, "_blank");
  }

  setTimeout(() => { state.cooldown = false; }, CONFIG.cooldown);
}

function bindEvents() {
  if (el.start) el.start.onclick = start;
  if (el.flip) el.flip.onclick = flip;

  if (el.upload && el.fileInput) {
    el.upload.onclick = () => el.fileInput.click();
    el.fileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      try {
        const result = await state.reader.decodeFromImageUrl(url);
        handleScan(result.getText());
      } catch (err) {
        console.warn(err);
        setStatus("Upload decode failed", "error");
      } finally {
        URL.revokeObjectURL(url);
      }
    };
  }

  if (el.photo && el.canvas && el.video && el.photoPreview) {
    el.photo.onclick = () => {
      const ctx = el.canvas.getContext("2d");
      el.canvas.width = el.video.videoWidth || 640;
      el.canvas.height = el.video.videoHeight || 480;
      ctx.drawImage(el.video, 0, 0, el.canvas.width, el.canvas.height);
      el.photoPreview.src = el.canvas.toDataURL("image/png");
      el.photoPreview.style.display = "block";
    };
  }

  if (el.send) {
    el.send.onclick = async () => {
      const data = el.payload.textContent || "";
      if (!data) {
        setStatus("No payload to send", "error");
        return;
      }
      setStatus("Analyzing payload…", "neutral");
      try {
        const analysis = await brain.process(data);
        ledger.addEntry(data, "MANUAL", {
          type: analysis.format ? `${analysis.format.name} (${analysis.format.type})` : analysis.type,
          pattern: analysis.pattern,
          explanation: analysis.explanation
        });
        setStatus("Signal logged", "success");
      } catch (e) {
        console.warn(e);
        setStatus("QAI analysis failed", "error");
      }
    };
  }

  if (el.resetLedger) {
    el.resetLedger.onclick = () => ledger.clear();
  }
}

document.readyState === "loading"
  ? document.addEventListener("DOMContentLoaded", init)
  : init();
