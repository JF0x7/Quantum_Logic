/* ============================================================
   UNIVERSAL BARCODE SCANNER
   Optimized for: iPhone 6, Raspberry Pi, all devices
   ============================================================ */

// ============================================================
// CONFIGURATION
// ============================================================

const CONFIG = {
    scanInterval: 80,          // MS between scans
    cooldownDelay: 800,        // MS cooldown after scan
    cropWidth: 0.5,            // Center crop width (percentage)
    cropHeight: 0.4,           // Center crop height (percentage)
    minVideoWidth: 320,        // Minimum video width
    maxVideoWidth: 1280,       // Maximum video width
    idealVideoWidth: 640,      // Ideal video width
    vibrateOnScan: true,       // Vibrate on successful scan
};

// ============================================================
// ELEMENTS (must exist in HTML)
// ============================================================

const elements = {
    video: document.getElementById("video"),
    canvas: document.getElementById("canvas"),
    status: document.getElementById("status"),
    payload: document.getElementById("payload"),
    preview: document.getElementById("photoPreview"),
    scanIndicator: document.getElementById("scanIndicator"),
    ledger: document.getElementById("ledger"),
    ledgerCount: document.getElementById("ledgerCount"),
    startBtn: document.getElementById("startBtn"),
    flipBtn: document.getElementById("flipBtn"),
    uploadBtn: document.getElementById("uploadBtn"),
    sendBtn: document.getElementById("sendBtn"),
    photoBtn: document.getElementById("photoBtn"),
    resetLedgerBtn: document.getElementById("resetLedgerBtn"),
    fileInput: document.getElementById("fileInput"),
};

// ============================================================
// STATE
// ============================================================

const state = {
    stream: null,
    lastScan: null,
    scanCooldown: false,
    currentDeviceIndex: 0,
    videoDevices: [],
    decodeLoopRunning: false,
    ledgerEntries: [],
    isInitialized: false,
};

// ============================================================
// ZXING SETUP
// ============================================================

const hints = new Map();
hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
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
    ZXing.BarcodeFormat.CODABAR,
]);

const codeReader = new ZXing.BrowserMultiFormatReader(hints);

// ============================================================
// UI HELPERS
// ============================================================

function setStatus(text, type = "neutral") {
    if (elements.status) {
        elements.status.textContent = text;
        elements.status.className = type;
    }
}

function setScanIndicator(active) {
    if (elements.scanIndicator) {
        elements.scanIndicator.className = active ? "active" : "";
    }
}

function setPayload(text) {
    if (elements.payload) {
        elements.payload.textContent = text || "—";
    }
}

// ============================================================
// LEDGER FUNCTIONS
// ============================================================

function addToLedger(data) {
    const timestamp = new Date().toLocaleTimeString();
    state.ledgerEntries.push({ data, timestamp });
    renderLedger();
}

function renderLedger() {
    if (elements.ledger) {
        elements.ledger.innerHTML = state.ledgerEntries.map(entry =>
            `<div>${entry.timestamp} — ${entry.data}</div>`
        ).join('');
    }
    if (elements.ledgerCount) {
        elements.ledgerCount.textContent = state.ledgerEntries.length;
    }
    if (elements.ledger) {
        elements.ledger.scrollTop = elements.ledger.scrollHeight;
    }
}

function clearLedger() {
    state.ledgerEntries = [];
    renderLedger();
    setStatus("🗑️ Ledger cleared", "neutral");
}

// ============================================================
// CAMERA FUNCTIONS
// ============================================================

function stopStream() {
    if (state.stream) {
        state.stream.getTracks().forEach(t => t.stop());
        state.stream = null;
        state.decodeLoopRunning = false;
    }
}

async function loadVideoDevices() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        state.videoDevices = devices.filter(d => d.kind === "videoinput");
        return state.videoDevices.length > 0;
    } catch (err) {
        console.warn("Device enumeration failed:", err);
        return false;
    }
}

async function startCamera() {
    setStatus("📷 Requesting camera...");
    stopStream();
    setScanIndicator(false);

    if (elements.preview) {
        elements.preview.classList.remove("visible");
    }

    if (!navigator.mediaDevices?.getUserMedia) {
        return setStatus("❌ Camera not supported on this device", "error");
    }

    const isLocal = location.hostname === "localhost" ||
        location.hostname === "127.0.0.1" ||
        location.hostname.startsWith("192.168.") ||
        location.hostname.startsWith("10.") ||
        location.hostname.startsWith("172.");

    if (location.protocol !== "https:" && !isLocal) {
        return setStatus("⚠️ Camera requires HTTPS or local network", "warning");
    }

    const hasDevices = await loadVideoDevices();
    if (!hasDevices) {
        return setStatus("❌ No cameras found", "error");
    }

    // Auto-select best camera
    if (state.videoDevices.length > 1) {
        const backCam = state.videoDevices.find(d =>
            d.label.toLowerCase().includes("back") ||
            d.label.toLowerCase().includes("environment")
        );
        if (backCam) {
            state.currentDeviceIndex = state.videoDevices.indexOf(backCam);
        } else {
            const piko = state.videoDevices.find(d =>
                d.label.toLowerCase().includes("emeet") ||
                d.label.toLowerCase().includes("pi")
            );
            if (piko) state.currentDeviceIndex = state.videoDevices.indexOf(piko);
        }
    }

    const selected = state.videoDevices[state.currentDeviceIndex];

    const constraints = {
        video: {
            deviceId: { exact: selected.deviceId },
            width: { ideal: CONFIG.idealVideoWidth, min: CONFIG.minVideoWidth, max: CONFIG.maxVideoWidth },
            height: { ideal: Math.round(CONFIG.idealVideoWidth * 0.75), min: Math.round(CONFIG.minVideoWidth * 0.75) },
            facingMode: "environment",
            frameRate: { ideal: 15, max: 30 }
        },
        audio: false
    };

    try {
        state.stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
        try {
            state.stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment", width: CONFIG.idealVideoWidth, height: Math.round(CONFIG.idealVideoWidth * 0.75) },
                audio: false
            });
        } catch (fallbackErr) {
            return setStatus("❌ Camera error: " + fallbackErr.message, "error");
        }
    }

    const video = elements.video;
    video.srcObject = state.stream;
    video.setAttribute("playsinline", "");
    video.muted = true;

    return new Promise((resolve) => {
        video.onloadedmetadata = () => {
            video.play().catch(() => {});

            const checkSize = () => {
                if (video.videoWidth > 0 && video.videoHeight > 0) {
                    const canvas = elements.canvas;
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    setStatus("📷 Camera active", "success");
                    startDecodeLoop();
                    resolve();
                } else {
                    setTimeout(checkSize, 100);
                }
            };
            setTimeout(checkSize, 200);
        };

        video.onerror = () => {
            setStatus("❌ Video error", "error");
            resolve();
        };
    });
}

async function flipCamera() {
    if (state.videoDevices.length <= 1) {
        return setStatus("ℹ Only one camera available", "neutral");
    }
    state.currentDeviceIndex = (state.currentDeviceIndex + 1) % state.videoDevices.length;
    await startCamera();
}

// ============================================================
// DECODE FUNCTIONS
// ============================================================

async function decodeFrame() {
    const video = elements.video;
    const canvas = elements.canvas;
    const ctx = canvas.getContext("2d");

    if (video.readyState < 2 || video.videoWidth === 0) return null;

    try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Try full frame first
        try {
            const luminance = new ZXing.RGBLuminanceSource(
                imageData.data,
                canvas.width,
                canvas.height
            );
            const bitmap = new ZXing.BinaryBitmap(
                new ZXing.HybridBinarizer(luminance)
            );
            return codeReader.decodeBitmap(bitmap);
        } catch (e) {
            // Full frame failed, try center crop
        }

        // Center crop
        const cropW = Math.floor(canvas.width * CONFIG.cropWidth);
        const cropH = Math.floor(canvas.height * CONFIG.cropHeight);
        const cropX = Math.floor((canvas.width - cropW) / 2);
        const cropY = Math.floor((canvas.height - cropH) / 2);

        try {
            const cropData = ctx.getImageData(cropX, cropY, cropW, cropH);
            const cropLum = new ZXing.RGBLuminanceSource(
                cropData.data,
                cropW,
                cropH
            );
            const cropBmp = new ZXing.BinaryBitmap(
                new ZXing.HybridBinarizer(cropLum)
            );
            return codeReader.decodeBitmap(cropBmp);
        } catch (e) {
            // No barcode found
        }

        return null;
    } catch (err) {
        return null;
    }
}

function startDecodeLoop() {
    state.decodeLoopRunning = true;
    let frameCount = 0;
    const startTime = performance.now();

    const loop = async () => {
        if (!state.decodeLoopRunning || !state.stream) return;

        const scanInterval = state.scanCooldown ? 150 : CONFIG.scanInterval;

        if (!state.scanCooldown) {
            try {
                const result = await decodeFrame();
                if (result) handleDecoded(result.text);
            } catch (err) {
                // Silent fail
            }
        }

        frameCount++;
        if (state.decodeLoopRunning) {
            setTimeout(loop, scanInterval);
        }
    };

    loop();
}

// ============================================================
// HANDLE DECODED PAYLOAD
// ============================================================

function handleDecoded(data) {
    if (data === state.lastScan) return;

    state.lastScan = data;
    state.scanCooldown = true;

    setPayload(data);
    setStatus("✅ Scanned: " + data.slice(0, 30) + (data.length > 30 ? "..." : ""), "success");
    setScanIndicator(true);

    if (CONFIG.vibrateOnScan && navigator.vibrate) {
        navigator.vibrate(50);
    }

    addToLedger(data);

    setTimeout(() => {
        state.scanCooldown = false;
        setScanIndicator(false);
    }, CONFIG.cooldownDelay);
}

// ============================================================
// PHOTO FUNCTIONS
// ============================================================

function takePhoto() {
    if (!state.stream) {
        return setStatus("❌ Camera not active", "error");
    }

    try {
        const canvas = elements.canvas;
        const ctx = canvas.getContext("2d");
        const video = elements.video;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const dataURL = canvas.toDataURL("image/png");
        if (elements.preview) {
            elements.preview.src = dataURL;
            elements.preview.classList.add("visible");
        }

        decodeFromCanvas();
    } catch (err) {
        setStatus("❌ Photo failed: " + err.message, "error");
    }
}

async function decodeFromCanvas() {
    try {
        const canvas = elements.canvas;
        const ctx = canvas.getContext("2d");
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const luminance = new ZXing.RGBLuminanceSource(
            imageData.data,
            canvas.width,
            canvas.height
        );
        const bitmap = new ZXing.BinaryBitmap(
            new ZXing.HybridBinarizer(luminance)
        );
        const result = codeReader.decodeBitmap(bitmap);

        handleDecoded(result.text);
        setStatus("📸 Photo decoded", "success");
    } catch (err) {
        setStatus("❌ No barcode found in photo", "warning");
    }
}

// ============================================================
// IMAGE UPLOAD
// ============================================================

async function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const imgURL = URL.createObjectURL(file);
    const img = new Image();
    img.src = imgURL;

    img.onload = async () => {
        const canvas = elements.canvas;
        const ctx = canvas.getContext("2d");

        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);

        if (elements.preview) {
            elements.preview.src = imgURL;
            elements.preview.classList.add("visible");
        }

        await decodeFromCanvas();
        URL.revokeObjectURL(imgURL);
    };

    img.onerror = () => {
        setStatus("❌ Failed to load image", "error");
        URL.revokeObjectURL(imgURL);
    };
}

// ============================================================
// EVENT BINDING
// ============================================================

function initEvents() {
    if (elements.startBtn) {
        elements.startBtn.addEventListener("click", startCamera);
    }

    if (elements.flipBtn) {
        elements.flipBtn.addEventListener("click", flipCamera);
    }

    if (elements.uploadBtn) {
        elements.uploadBtn.addEventListener("click", () => {
            if (elements.fileInput) elements.fileInput.click();
        });
    }

    if (elements.fileInput) {
        elements.fileInput.addEventListener("change", handleImageUpload);
    }

    if (elements.photoBtn) {
        elements.photoBtn.addEventListener("click", takePhoto);
    }

    if (elements.resetLedgerBtn) {
        elements.resetLedgerBtn.addEventListener("click", clearLedger);
    }

    if (elements.sendBtn) {
        elements.sendBtn.addEventListener("click", () => {
            const lastEntry = state.ledgerEntries[state.ledgerEntries.length - 1];
            if (lastEntry) {
                setStatus(`📡 Sending: ${lastEntry.data}`, "success");
                console.log("SEND:", lastEntry.data);
            } else {
                setStatus("📡 No data to send", "warning");
            }
        });
    }

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
        if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            if (!state.stream) {
                startCamera();
            } else {
                takePhoto();
            }
        }
        if (e.key === "f" || e.key === "F") {
            flipCamera();
        }
    });
}

// ============================================================
// INITIALIZATION
// ============================================================

function init() {
    if (state.isInitialized) return;
    state.isInitialized = true;

    initEvents();

    // Auto-start on user interaction
    let autoStarted = false;

    document.addEventListener("click", () => {
        if (!autoStarted) {
            autoStarted = true;
            if (navigator.mediaDevices?.getUserMedia) {
                startCamera();
            }
        }
    }, { once: true });

    document.addEventListener("touchstart", () => {
        if (!autoStarted) {
            autoStarted = true;
            if (navigator.mediaDevices?.getUserMedia) {
                setTimeout(startCamera, 100);
            }
        }
    }, { once: true });

    // Fallback: try to start after 2 seconds on desktop
    setTimeout(() => {
        if (!autoStarted && navigator.mediaDevices?.getUserMedia) {
            const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
            if (!isMobile) {
                autoStarted = true;
                startCamera();
            }
        }
    }, 2000);

    console.log("📷 Universal Barcode Scanner ready!");
    console.log("📱 Works on: iPhone 6, Raspberry Pi, all devices");
    console.log("⌨️  Space/Enter = Scan, F = Flip camera");
}

// ============================================================
// EXPOSE PUBLIC API
// ============================================================

const Scanner = {
    init,
    startCamera,
    flipCamera,
    takePhoto,
    clearLedger,
    addToLedger,
    setStatus,
    getLedger: () => state.ledgerEntries,
    getState: () => state,
    CONFIG,
};

// Auto-initialize when DOM is ready
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}

// Export for module usage
if (typeof module !== "undefined" && module.exports) {
    module.exports = Scanner;
}

// Make available globally
window.Scanner = Scanner;
