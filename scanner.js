/**
 * Universal Quantum Barcode Scanner Engine
 * Features: Multi-format 1D/2D Matrix Parsing, Auto-Redirect Routing, Camera Swapping
 */

// --- GLOBAL CONFIGURATION MATRIX ---
const CONFIG = {
    cooldownDelay: 3000,     // Lockout window (ms) to prevent infinite tab-spawning loops
    vibrateOnScan: true,     // Haptic pulse toggle for supported mobile devices
    autoRedirect: true       // Instantly launch URLs or execute web queries upon discovery
};

// --- CORE SYSTEM STATE ---
const state = {
    selectedDeviceId: null,
    videoDevices: [],
    codeReader: null,
    scanCooldown: false,
    lastScan: null
};

// --- DOM NODE REFERENCE INTERFACE ---
// Bind these key values to your presentation layout items
const elements = {
    video: document.getElementById("video"),
    payloadDisplay: document.getElementById("payload"),
    statusDisplay: document.getElementById("status"),
    startBtn: document.getElementById("startBtn"),
    flipBtn: document.getElementById("flipBtn")
};

// --- INITIALIZE ENGINE & FORCED DECODING HINTS ---
function initScannerEngine() {
    if (typeof ZXing !== 'undefined') {
        // Build parsing constraints map
        const hints = new Map();
        
        // CRITICAL: Forces deep multi-pass pixel analysis. 
        // Essential for dense 1D codes on books/cards and small crypto/QTUM QR layouts.
        hints.set(ZXing.DecodeHintType.TRY_HARDER, true);

        // Instantiating the engine with customized hints
        state.codeReader = new ZXing.BrowserMultiFormatReader(hints);
        updateStatus("Optics engine successfully compiled. Ready for initialization.", false);
        bindControlListeners();
    } else {
        updateStatus("Critical Failure: ZXing library resources not detected in scope.", true);
    }
}

// --- CORE OPTICS & CAPTURE MANAGEMENT ---
async function startCamera() {
    if (!state.codeReader) return;
    updateStatus("Warming up camera optics...");
    
    // Clear the deck and release any current camera locks
    state.codeReader.reset();

    try {
        // Fail-fast guard clause verifying secure hosting context (HTTPS/Localhost)
        if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error("Browser blocks hardware media access. Ensure site is served over HTTPS.");
        }

        // Poll system layout for video capture endpoints
        const videoInputDevices = await state.codeReader.listVideoInputDevices();
        state.videoDevices = videoInputDevices;

        if (videoInputDevices.length === 0) {
            throw new Error("No physical hardware capture nodes located on this system.");
        }

        // Automatic fallback selection logic (Prefers rear cameras on phones/tablets)
        if (!state.selectedDeviceId) {
            const strategicCam = videoInputDevices.find(device => 
                device.label.toLowerCase().includes('back') || 
                device.label.toLowerCase().includes('environment') ||
                device.label.toLowerCase().includes('rear')
            );
            state.selectedDeviceId = strategicCam ? strategicCam.deviceId : videoInputDevices[0].deviceId;
        }

        updateStatus("Lens track hot. Position barcode squarely inside viewfinder.");

        // Hand over the video rendering track and frame cycle over to ZXing's high-perf native loop
        state.codeReader.decodeFromVideoDevice(state.selectedDeviceId, 'video', (result, error) => {
            if (result) {
                processDecodedPayload(result.getText());
            }
            // Mute standard NotFoundExceptions to preserve device memory cycles
            if (error && !(error instanceof ZXing.NotFoundException)) {
                console.debug("Optical matrix artifact:", error);
            }
        });

    } catch (err) {
        updateStatus(`Connection Aborted: ${err.message}`, true);
    }
}

function flipCamera() {
    if (state.videoDevices.length <= 1) {
        updateStatus("No secondary camera tracking module found to switch to.");
        return;
    }
    const currentIndex = state.videoDevices.findIndex(d => d.deviceId === state.selectedDeviceId);
    const nextIndex = (currentIndex + 1) % state.videoDevices.length;
    state.selectedDeviceId = state.videoDevices[nextIndex].deviceId;
    startCamera();
}

function stopScanner() {
    if (state.codeReader) {
        state.codeReader.reset();
        updateStatus("Optics suspended. Standby mode active.");
    }
}

// --- PAYLOAD PARSING & ROUTING LAYER ---
function processDecodedPayload(data) {
    // Cooldown gate checking to keep tabs from spawning uncontrollably
    if (state.scanCooldown && data === state.lastScan) return;

    state.lastScan = data;
    state.scanCooldown = true;

    // Disseminate to local display elements if attached
    if (elements.payloadDisplay) elements.payloadDisplay.textContent = data;
    updateStatus("Signal Decoded!", false);

    // Dynamic High-Frequency Audio Tone Generation
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.value = 900;
        gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.08);
        setTimeout(() => audioCtx.close(), 200); // Cleans up audio context immediately
    } catch(e) {}

    // Haptic pulse dispatch
    if (CONFIG.vibrateOnScan && navigator.vibrate) {
        try { navigator.vibrate(60); } catch(e) {}
    }

    // INTERACTION / ROUTING ROUTINES
    const trimmedPayload = data.trim();
    const isUrl = /^(https?:\/\/[^\s]+)/i.test(trimmedPayload);

    if (CONFIG.autoRedirect) {
        if (isUrl) {
            updateStatus("Redirecting to target node payload...");
            window.open(trimmedPayload, '_blank');
        } else {
            // Non-URL scan fallback: Query data payload (Trading cards, ISBN books, serials) directly on search indices
            updateStatus("Dispatching string query to search engine...");
            window.open(`https://www.google.com/search?q=${encodeURIComponent(trimmedPayload)}`, '_blank');
        }
    }

    // Release system cooldown after specified threshold delay
    setTimeout(() => {
        state.scanCooldown = false;
    }, CONFIG.cooldownDelay);
}

// --- COMPONENT INTERFACE MANAGEMENT ---
function updateStatus(msg, isError = false) {
    if (elements.statusDisplay) {
        elements.statusDisplay.textContent = `Status: ${msg}`;
        elements.statusDisplay.style.color = isError ? "#ef4444" : "#38bdf8";
    }
    console.log(`[Scanner Core]: ${msg}`);
}

function bindControlListeners() {
    if (elements.startBtn) elements.startBtn.onclick = startCamera;
    if (elements.flipBtn) elements.flipBtn.onclick = flipCamera;
}

// Auto-boot up engine when document finishes evaluation pass
document.addEventListener("DOMContentLoaded", initScannerEngine);
