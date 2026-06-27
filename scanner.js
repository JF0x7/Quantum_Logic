// --- CONFIGURATION MATRIX ---
const CONFIG = {
    scanInterval: 120,      // Loop throttle (ms) to mitigate thermal CPU throttling on mobile
    cooldownDelay: 1000,    // Post-scan lockout duration (ms)
    vibrateOnScan: true     // Haptic feedback toggle
};

// --- CORE SYSTEM STATE ---
const state = {
    stream: null,
    lastScan: null,
    scanCooldown: false,
    currentDeviceIndex: 0,
    videoDevices: [],
    decodeLoopRunning: false,
    codeReader: null
};

// --- DOM NODE REFERENCE INTERFACE ---
// Match these IDs up with your custom HTML presentation layer
const elements = {
    video: document.getElementById("video"),
    canvas: document.getElementById("canvas"),
    payloadDisplay: document.getElementById("payload"),
    statusDisplay: document.getElementById("status"),
    fileInput: document.getElementById("fileInput")
};

// --- ENGINE INITIALIZATION ---
if (typeof ZXing !== 'undefined') {
    state.codeReader = new ZXing.BrowserMultiFormatReader();
} else {
    console.error("Critical Failure: ZXing engine missing from window runtime scope.");
}

// --- OPTICS ARCHITECTURE ---
async function startCamera() {
    stopStream();

    try {
        if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error("Target browser blocks hardware capture APIs globally.");
        }

        const devices = await navigator.mediaDevices.enumerateDevices();
        state.videoDevices = devices.filter(d => d.kind === 'videoinput');

        if (state.videoDevices.length === 0) {
            throw new Error("No physical hardware capture nodes located.");
        }

        // Auto-select environmental/rear camera setups on baseline boot
        if (state.videoDevices.length > 1 && state.currentDeviceIndex === 0) {
            const backIndex = state.videoDevices.findIndex(d => 
                d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('environment')
            );
            if (backIndex !== -1) state.currentDeviceIndex = backIndex;
        }

        const activeDevice = state.videoDevices[state.currentDeviceIndex];
        const constraints = {
            video: {
                deviceId: activeDevice ? { exact: activeDevice.deviceId } : undefined,
                facingMode: 'environment',
                width: { ideal: 640 },
                height: { ideal: 480 }
            },
            audio: false
        };

        state.stream = await navigator.mediaDevices.getUserMedia(constraints);
        elements.video.srcObject = state.stream;
        
        elements.video.onloadedmetadata = () => {
            elements.video.play();
            if (elements.canvas) {
                elements.canvas.width = elements.video.videoWidth;
                elements.canvas.height = elements.video.videoHeight;
            }
            state.decodeLoopRunning = true;
            executeDecodeLoop();
        };

    } catch (err) {
        console.error(`Camera Connection Failed: ${err.message}`);
    }
}

function stopStream() {
    state.decodeLoopRunning = false;
    if (state.stream) {
        state.stream.getTracks().forEach(track => track.stop());
        state.stream = null;
    }
}

function flipCamera() {
    if (state.videoDevices.length <= 1) return;
    state.currentDeviceIndex = (state.currentDeviceIndex + 1) % state.videoDevices.length;
    startCamera();
}

// --- CORE PARSING PIPELINE ---
async function executeDecodeLoop() {
    if (!state.decodeLoopRunning || !state.stream) return;

    if (!state.scanCooldown) {
        try {
            // Direct native engine parse straight from live HTML5 video playback node
            const result = await state.codeReader.decodeFromVideoElement(elements.video);
            if (result && result.text) {
                handleScannedData(result.text);
            }
        } catch (e) {
            // Structural drop-through: ZXing throws exceptions continuously when 
            // no barcode matrix is sharply visible in the frame context.
        }
    }

    // Combine setTimeout with requestAnimationFrame to prevent event loop blocking
    setTimeout(() => {
        if (state.decodeLoopRunning) requestAnimationFrame(executeDecodeLoop);
    }, CONFIG.scanInterval);
}

// --- DATA HANDLING & FEEDBACK ---
function handleScannedData(data) {
    if (data === state.lastScan && state.scanCooldown) return;

    state.lastScan = data;
    state.scanCooldown = true;

    // Disseminate to application frame
    if (elements.payloadDisplay) elements.payloadDisplay.textContent = data;
    
    // Safely emit to custom global event listeners if needed
    window.dispatchEvent(new CustomEvent('barcodeScanned', { detail: data }));

    // Non-blocking Audio context instantiator (Self-Cleaning to prevent leaks)
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.value = 950;
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.08);
        setTimeout(() => audioCtx.close(), 200);
    } catch(e) {}

    // Haptic pulse dispatch
    if (CONFIG.vibrateOnScan && navigator.vibrate) {
        try { navigator.vibrate(60); } catch(e) {}
    }

    // Enforce payload lock cool-off period
    setTimeout(() => { state.scanCooldown = false; }, CONFIG.cooldownDelay);
}

// --- GRAPHIC FILE UPLOAD FALLBACK ---
if (elements.fileInput) {
    elements.fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const url = URL.createObjectURL(file);
        const img = new Image();
        img.src = url;
        
        img.onload = async () => {
            try {
                const result = await state.codeReader.decodeFromImageElement(img);
                if (result && result.text) {
                    handleScannedData(result.text);
                }
            } catch (err) {
                console.warn("No verifiable matrix pattern located in uploaded static image.");
            } finally {
                URL.revokeObjectURL(url);
            }
        };
    };
}
