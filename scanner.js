// --- CONFIGURATION MATRIX ---
const CONFIG = {
    cooldownDelay: 2500,     // Lockout window (ms) to stop infinite pop-up loops after a launch
    vibrateOnScan: true,
    autoOpenLinks: true      // Instantly open resolved URLs in a new browser tab
};

// --- CORE SYSTEM STATE ---
const state = {
    selectedDeviceId: null,
    videoDevices: [],
    codeReader: null,
    scanCooldown: false,
    lastScan: null
};

// --- DOM NODE INTERFACE ---
const elements = {
    video: document.getElementById("video"),
    payloadDisplay: document.getElementById("payload"),
    statusDisplay: document.getElementById("status")
};

// --- CORE ENGINE INITIALIZATION WITH FORCED DECODE HINTS ---
if (typeof ZXing !== 'undefined') {
    // Explicitly configure hints to force comprehensive 1D and 2D matrix matching
    const hints = new Map();
    hints.set(ZXing.DecodeHintType.TRY_HARDER, true); 
    // This forces deep pixel checking for crypto codes, books (EAN), and card codes (Code 128/39)

    state.codeReader = new ZXing.BrowserMultiFormatReader(hints);
} else {
    updateStatus("Critical Failure: ZXing script resources not loaded.", "error");
}

function updateStatus(msg, isError = false) {
    if (elements.statusDisplay) {
        elements.statusDisplay.textContent = msg;
        elements.statusDisplay.style.color = isError ? "#ef4444" : "#38bdf8";
    }
    console.log(`[Scanner]: ${msg}`);
}

// --- OPTICS ARCHITECTURE & NATIVE STREAM PARSING ---
async function startCamera() {
    if (!state.codeReader) return;
    updateStatus("Initializing optics engine...");
    
    // Reset any active decoders running on the camera track
    state.codeReader.reset();

    try {
        if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error("Browser blocks media pipeline hardware permissions over standard HTTP. Enforce HTTPS.");
        }

        // Gather video inputs natively through ZXing mapper
        const videoInputDevices = await state.codeReader.listVideoInputDevices();
        state.videoDevices = videoInputDevices;

        if (videoInputDevices.length === 0) {
            throw new Error("No physical hardware capture nodes located.");
        }

        // Automatically target the rear/environmental camera if available
        if (!state.selectedDeviceId) {
            const backCam = videoInputDevices.find(d => 
                d.label.toLowerCase().includes('back') || 
                d.label.toLowerCase().includes('environment') ||
                d.label.toLowerCase().includes('rear')
            );
            state.selectedDeviceId = backCam ? backCam.deviceId : videoInputDevices[0].deviceId;
        }

        updateStatus("Optics active. Align target barcode within lens center.");

        // Use ZXing's native decoding loop—this performs much better on hardware like Raspberry Pi cameras
        state.codeReader.decodeFromVideoDevice(state.selectedDeviceId, 'video', (result, error) => {
            if (result) {
                handleScannedData(result.getText());
            }
            if (error && !(error instanceof ZXing.NotFoundException)) {
                // Ignore NotFoundException to keep the logs clean while searching the frame
                console.debug("Matrix tracking artifact:", error);
            }
        });

    } catch (err) {
        updateStatus(`Connection Aborted: ${err.message}`, true);
    }
}

function flipCamera() {
    if (state.videoDevices.length <= 1) {
        updateStatus("No secondary camera tracking module discovered.");
        return;
    }
    const currentIndex = state.videoDevices.findIndex(d => d.deviceId === state.selectedDeviceId);
    const nextIndex = (currentIndex + 1) % state.videoDevices.length;
    state.selectedDeviceId = state.videoDevices[nextIndex].deviceId;
    startCamera();
}

// --- PIPELINE DATA RESOLUTION & REDIRECTION ---
function handleScannedData(data) {
    // Block double-triggers during active cooldown operations
    if (state.scanCooldown && data === state.lastScan) return;

    state.lastScan = data;
    state.scanCooldown = true;

    if (elements.payloadDisplay) elements.payloadDisplay.textContent = data;
    updateStatus("Signal Decoded!", false);

    // Audio Haptic Trigger Pipeline
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
        setTimeout(() => audioCtx.close(), 250);
    } catch(e) {}

    if (CONFIG.vibrateOnScan && navigator.vibrate) {
        try { navigator.vibrate(80); } catch(e) {}
    }

    // URL Parsing Verification & Redirection Layer
    const cleanData = data.trim();
    const isUrl = /^(https?:\/\/[^\s]+)/i.test(cleanData);

    if (isUrl && CONFIG.autoOpenLinks) {
        updateStatus("Redirecting to target node payload...");
        window.open(cleanData, '_blank');
    } else if (CONFIG.autoOpenLinks) {
        // If it's a plain barcode string (like a book ISBN or trading card tracking number),
        // fallback to opening a standard search engine query for that asset string.
        updateStatus("Querying string on search index...");
        window.open(`https://www.google.com/search?q=${encodeURIComponent(cleanData)}`, '_blank');
    }

    // Cooldown reset to prevent browser tab spamming
    setTimeout(() => {
        state.scanCooldown = false;
    }, CONFIG.cooldownDelay);
}

function stopScanner() {
    if (state.codeReader) {
        state.codeReader.reset();
        updateStatus("Optics suspended. Standby mode active.");
    }
}
