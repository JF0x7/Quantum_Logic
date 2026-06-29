/**
 * Quantum Scanner Engine — Raspberry Pi, Mobile & Webcam Optimized Edition
 * Ultra-stable ZXing wrapper with optimized barcode routing + hardware compatibility
 */
import QuantumLedger from "./ledger.js";

const ledger = new QuantumLedger("ledger");
const CONFIG = {
    cooldownDelay: 3000,       // Guard time (ms) to prevent infinite tab-spawning loops
    vibrateOnScan: true,       // Haptic pulse toggle
    autoRedirect: true,        // Open URLs or dispatch queries instantly on scan
    beepFrequency: 950,        // Pitch of success tone (Hz)
    beepVolume: 0.08,          // Safe volume coefficient
    beepDuration: 0.10         // Duration of feedback chime (seconds)
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
   ENGINE INITIALIZATION WITH MULTI-FORMAT DECODER MATRIX
---------------------------------------------------------- */
function initScannerEngine() {
    if (typeof ZXing === "undefined") {
        updateStatus("ZXing not found. Ensure the ZXing CDN script is imported.", true);
        return;
    }

    // Configure comprehensive decoding hints
    const hints = new Map();

    // CRITICAL: Forces pixel-by-pixel checking. Absolutely essential for small, dense 
    // codes (book barcodes, trading cards, custom QTUM / crypto layout matrices).
    hints.set(ZXing.DecodeHintType.TRY_HARDER, true);

    // Explicitly define formats to prevent decoding drop-offs on diverse hardware
    const formats = [
        ZXing.BarcodeFormat.QR_CODE,
        ZXing.BarcodeFormat.DATA_MATRIX,
        ZXing.BarcodeFormat.AZTEC,
        ZXing.BarcodeFormat.PDF_417,
        ZXing.BarcodeFormat.EAN_13,
        ZXing.BarcodeFormat.EAN_8,
        ZXing.BarcodeFormat.UPC_A,
        ZXing.BarcodeFormat.UPC_E,
        ZXing.BarcodeFormat.CODE_128,
        ZXing.BarcodeFormat.CODE_39,
        ZXing.BarcodeFormat.ITF,
        ZXing.BarcodeFormat.CODABAR
    ];
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, formats);

    state.codeReader = new ZXing.BrowserMultiFormatReader(hints);
    state.engineReady = true;

    // Standardize video playback element dynamically to bypass mobile security structures
    prepareVideoElement();

    updateStatus("Scanner engine online. Ready for camera activation.");
    bindControlListeners();
}

/**
 * Standardizes the video tag to prevent playback freezing on iOS Safari/Chrome
 */
function prepareVideoElement() {
    if (elements.video) {
        elements.video.setAttribute("autoplay", "");
        elements.video.setAttribute("playsinline", "");
        elements.video.setAttribute("muted", "");
        elements.video.muted = true;
    }
}

/* ----------------------------------------------------------
   CAMERA STARTUP WITH INTENSITY CONTROL
---------------------------------------------------------- */
async function startCamera() {
    if (!state.engineReady) {
        updateStatus("Engine not initialized yet.", true);
        return;
    }

    updateStatus("Searching for video capture sources...");

    try {
        // Drop any active streams to avoid resource locking
        state.codeReader.reset();

        const devices = await state.codeReader.listVideoInputDevices();
        state.videoDevices = devices;

        if (devices.length === 0) {
            throw new Error("No camera hardware devices found.");
        }

        // Automatic environmental targeting (rears) to ensure autofocus compatibility
        if (!state.selectedDeviceId) {
            const strategicDevice = devices.find(d =>
                d.label.toLowerCase().includes("back") ||
                d.label.toLowerCase().includes("rear") ||
                d.label.toLowerCase().includes("environment")
            );
            state.selectedDeviceId = strategicDevice ? strategicDevice.deviceId : devices[0].deviceId;
        }

        const activeDevice = devices.find(d => d.deviceId === state.selectedDeviceId);
        updateStatus(`Connecting to: ${activeDevice ? activeDevice.label : "Default Optic Node"}...`);

        // Force a performance-optimized media footprint constraint.
        // Extremely high resolutions will cause Raspberry Pi CPU rendering delay.
        const customConstraints = {
            video: {
                deviceId: { exact: state.selectedDeviceId },
                facingMode: "environment",
                width: { ideal: 1280, max: 1920 },
                height: { ideal: 720, max: 1080 },
                frameRate: { ideal: 30 }
            }
        };

        // Hand over stream control to ZXing's high-efficiency native capture stream loop
        state.codeReader.decodeFromConstraints(
            customConstraints,
            elements.video,
            (result, error) => {
                if (result) {
                    processDecodedPayload(result.getText());
                }
                // Suppress standard scan errors so logs aren't flooded while hunting the viewfinder
                if (error && !(error instanceof ZXing.NotFoundException)) {
                    console.debug("Optical tracking artifact:", error);
                }
            }
        );

        updateStatus("Lens track live. Position code squarely in view.");

    } catch (err) {
        updateStatus(`Camera error: ${err.message}`, true);
    }
}

/* ----------------------------------------------------------
   CAMERA FLIP
---------------------------------------------------------- */
function flipCamera() {
    if (state.videoDevices.length <= 1) {
        updateStatus("No secondary optical array detected to flip to.");
        return;
    }

    const idx = state.videoDevices.findIndex(d => d.deviceId === state.selectedDeviceId);
    const next = (idx + 1) % state.videoDevices.length;
    state.selectedDeviceId = state.videoDevices[next].deviceId;

    updateStatus("Swapping optical tracking tracks...");
    startCamera();
}

/* ----------------------------------------------------------
   STOP SCANNER
---------------------------------------------------------- */
function stopScanner() {
    if (state.codeReader) {
        state.codeReader.reset();
        updateStatus("Optics suspended. Standby mode active.");
    }
}

/* ----------------------------------------------------------
   PAYLOAD PROCESSING & SEARCH ENGINE DISPATCH
---------------------------------------------------------- */
function processDecodedPayload(data) {
    if (state.scanCooldown && data === state.lastScan) return;

    state.lastScan = data;
    state.scanCooldown = true;

    if (elements.payloadDisplay) {
        elements.payloadDisplay.textContent = data;
    }
    updateStatus("Optical matrix decoded successfully!", false);

    playBeep();
    triggerHaptic();

    const trimmed = data.trim();
    const isUrl = /^(https?:\/\/[^\s]+)/i.test(trimmed);

    if (CONFIG.autoRedirect) {
        if (isUrl) {
            updateStatus("Redirecting to online target node...");
            // Use _blank and enforce cross-origin performance safety
            const newTab = window.open(trimmed, "_blank");
            if (newTab) newTab.focus();
        } else {
            // General query dispatch (Falls back to google search index for books/cards/crypto strings)
            updateStatus("Querying asset database index...");
            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
            const newTab = window.open(searchUrl, "_blank");
            if (newTab) newTab.focus();
        }
    }

    // Release system locks after cooldown threshold elapsed
    setTimeout(() => {
        state.scanCooldown = false;
    }, CONFIG.cooldownDelay);
}
// After decoding:
ledger.addEntry(decodedText, "SCAN");
/* ----------------------------------------------------------
   AUDIO + HAPTIC FEEDBACK (Memory Leak Immune)
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

        // Closes connection explicitly to prevent memory leaks in rapid operations
        setTimeout(() => {
            if (ctx.state !== "closed") {
                ctx.close();
            }
        }, 300);
    } catch (e) {
        console.warn("Feedback audio pipeline blocked by browser interaction restrictions.");
    }
}

function triggerHaptic() {
    if (CONFIG.vibrateOnScan && navigator.vibrate) {
        try {
            navigator.vibrate(80);
        } catch (e) {
            // Silently absorb errors if unsupported
        }
    }
}

/* ----------------------------------------------------------
   STATUS DISPLAY
---------------------------------------------------------- */
function updateStatus(msg, isError = false) {
    if (elements.statusDisplay) {
        elements.statusDisplay.textContent = `Status: ${msg}`;
        elements.statusDisplay.style.color = isError ? "#ef4444" : "#38bdf8";
    }
    console.log(`[Scanner Core]: ${msg}`);
}

/* ----------------------------------------------------------
   EVENT BINDING
---------------------------------------------------------- */
function bindControlListeners() {
    if (elements.startBtn) {
        elements.startBtn.onclick = startCamera;
    }
    if (elements.flipBtn) {
        elements.flipBtn.onclick = flipCamera;
    }
}

// Automatically initiate engine evaluation loop upon document ready
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initScannerEngine);
} else {
    initScannerEngine();
}
