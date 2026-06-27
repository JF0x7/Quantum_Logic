/**
 * Quantum Scanner Engine — Raspberry Pi Optimized Edition
 * Ultra-stable ZXing wrapper with hardened camera routing + scan reliability boosts
 */

const CONFIG = {
    cooldownDelay: 2500,
    vibrateOnScan: true,
    autoRedirect: true,
    beepFrequency: 900,
    beepVolume: 0.05,
    beepDuration: 0.08
};

const state = {
    selectedDeviceId: null,
    videoDevices: [],
    codeReader: null,
    scanCooldown: false,
    lastScan: null,
    engineReady: false
};

const elements = {
    video: document.getElementById("video"),
    payloadDisplay: document.getElementById("payload"),
    statusDisplay: document.getElementById("status"),
    startBtn: document.getElementById("startBtn"),
    flipBtn: document.getElementById("flipBtn")
};

/* ----------------------------------------------------------
   ENGINE INITIALIZATION
---------------------------------------------------------- */
function initScannerEngine() {
    if (typeof ZXing === "undefined") {
        updateStatus("ZXing not found. Ensure ZXing script is loaded.", true);
        return;
    }

    const hints = new Map();
    hints.set(ZXing.DecodeHintType.TRY_HARDER, true);

    state.codeReader = new ZXing.BrowserMultiFormatReader(hints);
    state.engineReady = true;

    updateStatus("Scanner engine online. Ready for camera activation.");
    bindControlListeners();
}

/* ----------------------------------------------------------
   CAMERA STARTUP
---------------------------------------------------------- */
async function startCamera() {
    if (!state.engineReady) {
        updateStatus("Engine not initialized.", true);
        return;
    }

    updateStatus("Activating camera…");

    try {
        state.codeReader.reset();

        const devices = await state.codeReader.listVideoInputDevices();
        state.videoDevices = devices;

        if (devices.length === 0) {
            throw new Error("No camera devices detected.");
        }

        if (!state.selectedDeviceId) {
            const rear = devices.find(d =>
                d.label.toLowerCase().includes("back") ||
                d.label.toLowerCase().includes("rear") ||
                d.label.toLowerCase().includes("environment")
            );
            state.selectedDeviceId = rear ? rear.deviceId : devices[0].deviceId;
        }

        updateStatus("Camera online. Aim barcode at the center.");

        state.codeReader.decodeFromVideoDevice(
            state.selectedDeviceId,
            elements.video,
            (result, error) => {
                if (result) {
                    processDecodedPayload(result.getText());
                }
                if (error && !(error instanceof ZXing.NotFoundException)) {
                    console.debug("Decode error:", error);
                }
            }
        );

    } catch (err) {
        updateStatus(`Camera error: ${err.message}`, true);
    }
}

/* ----------------------------------------------------------
   CAMERA FLIP
---------------------------------------------------------- */
function flipCamera() {
    if (state.videoDevices.length <= 1) {
        updateStatus("Only one camera available.");
        return;
    }

    const idx = state.videoDevices.findIndex(d => d.deviceId === state.selectedDeviceId);
    const next = (idx + 1) % state.videoDevices.length;
    state.selectedDeviceId = state.videoDevices[next].deviceId;

    updateStatus("Switching camera…");
    startCamera();
}

/* ----------------------------------------------------------
   STOP SCANNER
---------------------------------------------------------- */
function stopScanner() {
    if (state.codeReader) {
        state.codeReader.reset();
        updateStatus("Scanner paused.");
    }
}

/* ----------------------------------------------------------
   PAYLOAD PROCESSING
---------------------------------------------------------- */
function processDecodedPayload(data) {
    if (state.scanCooldown && data === state.lastScan) return;

    state.lastScan = data;
    state.scanCooldown = true;

    elements.payloadDisplay.textContent = data;
    updateStatus("Scan successful!");

    playBeep();
    triggerHaptic();

    const trimmed = data.trim();
    const isUrl = /^(https?:\/\/[^\s]+)/i.test(trimmed);

    if (CONFIG.autoRedirect) {
        if (isUrl) {
            updateStatus("Opening URL…");
            window.open(trimmed, "_blank");
        } else {
            updateStatus("Searching payload…");
            window.open(`https://www.google.com/search?q=${encodeURIComponent(trimmed)}`, "_blank");
        }
    }

    setTimeout(() => {
        state.scanCooldown = false;
    }, CONFIG.cooldownDelay);
}

/* ----------------------------------------------------------
   AUDIO + HAPTIC FEEDBACK
---------------------------------------------------------- */
function playBeep() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.frequency.value = CONFIG.beepFrequency;
        gain.gain.value = CONFIG.beepVolume;

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + CONFIG.beepDuration);

        setTimeout(() => ctx.close(), 200);
    } catch (e) {}
}

function triggerHaptic() {
    if (CONFIG.vibrateOnScan && navigator.vibrate) {
        try { navigator.vibrate(60); } catch (e) {}
    }
}

/* ----------------------------------------------------------
   STATUS DISPLAY
---------------------------------------------------------- */
function updateStatus(msg, isError = false) {
    elements.statusDisplay.textContent = `Status: ${msg}`;
    elements.statusDisplay.style.color = isError ? "#ef4444" : "#38bdf8";
    console.log(`[Scanner]: ${msg}`);
}

/* ----------------------------------------------------------
   EVENT BINDING
---------------------------------------------------------- */
function bindControlListeners() {
    elements.startBtn.onclick = startCamera;
    elements.flipBtn.onclick = flipCamera;
}

document.addEventListener("DOMContentLoaded", initScannerEngine);
