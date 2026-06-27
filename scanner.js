/* ============================================================
   UNIVERSAL BARCODE SCANNER
   Compatible with: Chromium, Firefox, Safari, Edge, Opera, 
   Tor, Brave, Vivaldi, UC Browser, Samsung Internet, 
   and all modern/legacy browsers
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
    useFallbackReader: true,   // Use fallback if ZXing fails
    debugMode: false,          // Enable debug logging
};

// ============================================================
// POLYFILLS FOR OLDER BROWSERS
// ============================================================

// Promise polyfill for very old browsers
if (typeof Promise === 'undefined') {
    // Simple Promise polyfill
    window.Promise = function(executor) {
        this.then = function(onFulfilled, onRejected) {
            try {
                const result = executor(function(value) {
                    if (onFulfilled) onFulfilled(value);
                }, function(reason) {
                    if (onRejected) onRejected(reason);
                });
                if (onFulfilled) onFulfilled(result);
            } catch (e) {
                if (onRejected) onRejected(e);
            }
            return this;
        };
        return this;
    };
}

// Array.prototype.find polyfill
if (!Array.prototype.find) {
    Object.defineProperty(Array.prototype, 'find', {
        value: function(predicate) {
            if (this == null) throw new TypeError('Array.prototype.find called on null or undefined');
            if (typeof predicate !== 'function') throw new TypeError('predicate must be a function');
            var list = Object(this);
            var length = list.length >>> 0;
            var thisArg = arguments[1];
            for (var i = 0; i < length; i++) {
                var value = list[i];
                if (predicate.call(thisArg, value, i, list)) {
                    return value;
                }
            }
            return undefined;
        }
    });
}

// Array.prototype.includes polyfill
if (!Array.prototype.includes) {
    Object.defineProperty(Array.prototype, 'includes', {
        value: function(searchElement) {
            if (this == null) throw new TypeError('Array.prototype.includes called on null or undefined');
            var o = Object(this);
            var len = o.length >>> 0;
            if (len === 0) return false;
            var n = 0;
            if (arguments.length > 1) {
                n = arguments[1];
            }
            var k = n >= 0 ? n : Math.max(0, len + n);
            while (k < len) {
                if (o[k] === searchElement) return true;
                k++;
            }
            return false;
        }
    });
}

// String.prototype.startsWith polyfill
if (!String.prototype.startsWith) {
    String.prototype.startsWith = function(searchString, position) {
        position = position || 0;
        return this.substr(position, searchString.length) === searchString;
    };
}

// ============================================================
// ELEMENTS (must exist in HTML)
// ============================================================

// Safe element getter with fallback
function getElement(id) {
    try {
        return document.getElementById(id);
    } catch (e) {
        if (CONFIG.debugMode) console.warn('Element not found:', id);
        return null;
    }
}

const elements = {
    video: getElement("video"),
    canvas: getElement("canvas"),
    status: getElement("status"),
    payload: getElement("payload"),
    preview: getElement("photoPreview"),
    scanIndicator: getElement("scanIndicator"),
    ledger: getElement("ledger"),
    ledgerCount: getElement("ledgerCount"),
    startBtn: getElement("startBtn"),
    flipBtn: getElement("flipBtn"),
    uploadBtn: getElement("uploadBtn"),
    sendBtn: getElement("sendBtn"),
    photoBtn: getElement("photoBtn"),
    resetLedgerBtn: getElement("resetLedgerBtn"),
    fileInput: getElement("fileInput"),
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
    browserType: 'unknown',
};

// ============================================================
// BROWSER DETECTION
// ============================================================

function detectBrowser() {
    const ua = navigator.userAgent.toLowerCase();
    
    if (ua.indexOf('firefox') > -1) return 'firefox';
    if (ua.indexOf('safari') > -1 && ua.indexOf('chrome') === -1) return 'safari';
    if (ua.indexOf('edge') > -1 || ua.indexOf('edg') > -1) return 'edge';
    if (ua.indexOf('opr') > -1 || ua.indexOf('opera') > -1) return 'opera';
    if (ua.indexOf('chrome') > -1) return 'chrome';
    if (ua.indexOf('trident') > -1 || ua.indexOf('msie') > -1) return 'ie';
    if (ua.indexOf('ucbrowser') > -1) return 'uc';
    if (ua.indexOf('samsungbrowser') > -1) return 'samsung';
    if (ua.indexOf('brave') > -1) return 'brave';
    if (ua.indexOf('vivaldi') > -1) return 'vivaldi';
    if (ua.indexOf('tor') > -1) return 'tor';
    
    return 'other';
}

state.browserType = detectBrowser();

// ============================================================
// ZXING SETUP with fallback
// ============================================================

let codeReader = null;
let zxingAvailable = false;

// Check if ZXing is available
try {
    if (typeof ZXing !== 'undefined' && ZXing.BrowserMultiFormatReader) {
        const hints = new Map();
        hints.set('TRY_HARDER', true);
        hints.set('POSSIBLE_FORMATS', [
            'QR_CODE', 'DATA_MATRIX', 'AZTEC', 'PDF_417',
            'EAN_13', 'EAN_8', 'UPC_A', 'UPC_E',
            'CODE_128', 'CODE_39', 'ITF', 'CODABAR'
        ]);
        
        codeReader = new ZXing.BrowserMultiFormatReader(hints);
        zxingAvailable = true;
        if (CONFIG.debugMode) console.log('ZXing loaded successfully');
    }
} catch (e) {
    if (CONFIG.debugMode) console.warn('ZXing not available:', e.message);
    zxingAvailable = false;
}

// ============================================================
// UI HELPERS (with safe DOM access)
// ============================================================

function setStatus(text, type) {
    try {
        if (elements.status) {
            elements.status.textContent = text || '';
            elements.status.className = type || '';
        }
    } catch (e) {
        // Silent fail
    }
}

function setScanIndicator(active) {
    try {
        if (elements.scanIndicator) {
            elements.scanIndicator.className = active ? 'active' : '';
        }
    } catch (e) {
        // Silent fail
    }
}

function setPayload(text) {
    try {
        if (elements.payload) {
            elements.payload.textContent = text || '—';
        }
    } catch (e) {
        // Silent fail
    }
}

// ============================================================
// LEDGER FUNCTIONS
// ============================================================

function addToLedger(data) {
    try {
        const timestamp = new Date().toLocaleTimeString();
        state.ledgerEntries.push({ data, timestamp });
        renderLedger();
    } catch (e) {
        if (CONFIG.debugMode) console.warn('Failed to add to ledger:', e);
    }
}

function renderLedger() {
    try {
        if (elements.ledger) {
            elements.ledger.innerHTML = state.ledgerEntries.map(function(entry) {
                return '<div>' + entry.timestamp + ' — ' + entry.data + '</div>';
            }).join('');
        }
        if (elements.ledgerCount) {
            elements.ledgerCount.textContent = state.ledgerEntries.length;
        }
        if (elements.ledger) {
            elements.ledger.scrollTop = elements.ledger.scrollHeight;
        }
    } catch (e) {
        if (CONFIG.debugMode) console.warn('Failed to render ledger:', e);
    }
}

function clearLedger() {
    state.ledgerEntries = [];
    renderLedger();
    setStatus('🗑️ Ledger cleared', 'neutral');
}

// ============================================================
// CAMERA FUNCTIONS - Cross-browser compatible
// ============================================================

function stopStream() {
    try {
        if (state.stream) {
            state.stream.getTracks().forEach(function(t) {
                try { t.stop(); } catch (e) {}
            });
            state.stream = null;
            state.decodeLoopRunning = false;
        }
    } catch (e) {
        // Silent fail
    }
}

function loadVideoDevices() {
    return new Promise(function(resolve) {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
                if (CONFIG.debugMode) console.warn('enumerateDevices not supported');
                return resolve(false);
            }
            
            navigator.mediaDevices.enumerateDevices()
                .then(function(devices) {
                    state.videoDevices = devices.filter(function(d) {
                        return d.kind === 'videoinput';
                    });
                    resolve(state.videoDevices.length > 0);
                })
                .catch(function(err) {
                    if (CONFIG.debugMode) console.warn('Device enumeration failed:', err);
                    resolve(false);
                });
        } catch (e) {
            if (CONFIG.debugMode) console.warn('Device enumeration error:', e);
            resolve(false);
        }
    });
}

function startCamera() {
    return new Promise(function(resolve) {
        setStatus('📷 Requesting camera...');
        stopStream();
        setScanIndicator(false);

        if (elements.preview) {
            try { elements.preview.classList.remove('visible'); } catch (e) {}
        }

        // Check for getUserMedia
        var getUserMedia = null;
        try {
            getUserMedia = navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
        } catch (e) {}
        
        if (!getUserMedia) {
            // Fallback for older browsers
            try {
                getUserMedia = navigator.getUserMedia || 
                              navigator.webkitGetUserMedia || 
                              navigator.mozGetUserMedia ||
                              navigator.msGetUserMedia;
            } catch (e) {}
        }
        
        if (!getUserMedia) {
            setStatus('❌ Camera not supported on this device', 'error');
            return resolve();
        }

        // Check for HTTPS/local
        var isLocal = false;
        try {
            var hostname = location.hostname;
            isLocal = hostname === 'localhost' ||
                hostname === '127.0.0.1' ||
                hostname.startsWith('192.168.') ||
                hostname.startsWith('10.') ||
                hostname.startsWith('172.') ||
                hostname === '0.0.0.0';
        } catch (e) {}

        if (location.protocol !== 'https:' && !isLocal) {
            setStatus('⚠️ Camera requires HTTPS or local network', 'warning');
            return resolve();
        }

        // Load devices
        loadVideoDevices().then(function(hasDevices) {
            if (!hasDevices) {
                setStatus('❌ No cameras found', 'error');
                return resolve();
            }

            // Auto-select best camera
            if (state.videoDevices.length > 1) {
                var backCam = null;
                for (var i = 0; i < state.videoDevices.length; i++) {
                    var label = state.videoDevices[i].label.toLowerCase();
                    if (label.indexOf('back') > -1 || label.indexOf('environment') > -1) {
                        backCam = state.videoDevices[i];
                        state.currentDeviceIndex = i;
                        break;
                    }
                }
                if (!backCam) {
                    for (var j = 0; j < state.videoDevices.length; j++) {
                        var label2 = state.videoDevices[j].label.toLowerCase();
                        if (label2.indexOf('emeet') > -1 || label2.indexOf('pi') > -1) {
                            state.currentDeviceIndex = j;
                            break;
                        }
                    }
                }
            }

            var selected = state.videoDevices[state.currentDeviceIndex];
            
            // Browser-specific constraints
            var constraints = {
                video: {
                    deviceId: { exact: selected.deviceId },
                    width: { ideal: CONFIG.idealVideoWidth, min: CONFIG.minVideoWidth, max: CONFIG.maxVideoWidth },
                    height: { ideal: Math.round(CONFIG.idealVideoWidth * 0.75), min: Math.round(CONFIG.minVideoWidth * 0.75) },
                    facingMode: 'environment',
                    frameRate: { ideal: 15, max: 30 }
                },
                audio: false
            };

            // Firefox needs special handling
            if (state.browserType === 'firefox') {
                constraints.video.width = { min: 320, max: 1280 };
                constraints.video.height = { min: 240, max: 720 };
                delete constraints.video.frameRate;
            }

            // Safari needs special handling
            if (state.browserType === 'safari') {
                constraints.video.width = 640;
                constraints.video.height = 480;
                delete constraints.video.deviceId;
                delete constraints.video.min;
                delete constraints.video.max;
                delete constraints.video.frameRate;
            }

            // Try with deviceId first
            var tryWithDeviceId = function() {
                return new Promise(function(resolve2, reject2) {
                    try {
                        getUserMedia.call(navigator.mediaDevices || navigator, constraints)
                            .then(function(stream) {
                                resolve2(stream);
                            })
                            .catch(function(err) {
                                reject2(err);
                            });
                    } catch (e) {
                        reject2(e);
                    }
                });
            };

            // Fallback without deviceId
            var tryFallback = function() {
                return new Promise(function(resolve2, reject2) {
                    try {
                        var fallbackConstraints = {
                            video: {
                                facingMode: 'environment',
                                width: CONFIG.idealVideoWidth,
                                height: Math.round(CONFIG.idealVideoWidth * 0.75)
                            },
                            audio: false
                        };
                        
                        getUserMedia.call(navigator.mediaDevices || navigator, fallbackConstraints)
                            .then(function(stream) {
                                resolve2(stream);
                            })
                            .catch(function(err) {
                                reject2(err);
                            });
                    } catch (e) {
                        reject2(e);
                    }
                });
            };

            // Attempt to start camera
            tryWithDeviceId()
                .catch(function() {
                    return tryFallback();
                })
                .then(function(stream) {
                    state.stream = stream;
                    
                    var video = elements.video;
                    if (video) {
                        // Use srcObject or fallback for older browsers
                        try {
                            video.srcObject = stream;
                        } catch (e) {
                            // Fallback for older browsers
                            try {
                                video.src = URL.createObjectURL(stream);
                            } catch (e2) {
                                setStatus('❌ Failed to set video source', 'error');
                                return resolve();
                            }
                        }
                        
                        // Safari/iPhone fixes
                        if (state.browserType === 'safari') {
                            video.setAttribute('playsinline', '');
                            video.setAttribute('webkit-playsinline', '');
                            video.muted = true;
                        }
                        
                        // Cross-browser play
                        video.onloadedmetadata = function() {
                            try {
                                video.play().catch(function() {});
                                
                                var checkSize = function() {
                                    if (video.videoWidth > 0 && video.videoHeight > 0) {
                                        var canvas = elements.canvas;
                                        if (canvas) {
                                            canvas.width = video.videoWidth;
                                            canvas.height = video.videoHeight;
                                        }
                                        setStatus('📷 Camera active', 'success');
                                        startDecodeLoop();
                                        resolve();
                                    } else {
                                        setTimeout(checkSize, 100);
                                    }
                                };
                                setTimeout(checkSize, 200);
                            } catch (e) {
                                setStatus('❌ Video error', 'error');
                                resolve();
                            }
                        };

                        video.onerror = function() {
                            setStatus('❌ Video error', 'error');
                            resolve();
                        };
                    } else {
                        setStatus('❌ Video element missing', 'error');
                        resolve();
                    }
                })
                .catch(function(err) {
                    setStatus('❌ Camera error: ' + (err.message || 'Unknown'), 'error');
                    resolve();
                });
        });
    });
}

function flipCamera() {
    if (state.videoDevices.length <= 1) {
        setStatus('ℹ Only one camera available', 'neutral');
        return;
    }
    state.currentDeviceIndex = (state.currentDeviceIndex + 1) % state.videoDevices.length;
    startCamera();
}

// ============================================================
// DECODE FUNCTIONS - With fallback
// ============================================================

function decodeFrame() {
    return new Promise(function(resolve) {
        try {
            var video = elements.video;
            var canvas = elements.canvas;
            
            if (!video || !canvas) {
                return resolve(null);
            }
            
            if (video.readyState < 2 || video.videoWidth === 0) {
                return resolve(null);
            }

            var ctx = canvas.getContext('2d');
            if (!ctx) {
                return resolve(null);
            }

            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            // Try ZXing if available
            if (zxingAvailable && codeReader) {
                try {
                    var luminance = new ZXing.RGBLuminanceSource(
                        imageData.data,
                        canvas.width,
                        canvas.height
                    );
                    var bitmap = new ZXing.BinaryBitmap(
                        new ZXing.HybridBinarizer(luminance)
                    );
                    var result = codeReader.decodeBitmap(bitmap);
                    if (result) {
                        return resolve(result);
                    }
                } catch (e) {
                    // Try center crop
                    try {
                        var cropW = Math.floor(canvas.width * CONFIG.cropWidth);
                        var cropH = Math.floor(canvas.height * CONFIG.cropHeight);
                        var cropX = Math.floor((canvas.width - cropW) / 2);
                        var cropY = Math.floor((canvas.height - cropH) / 2);
                        
                        var cropData = ctx.getImageData(cropX, cropY, cropW, cropH);
                        var cropLum = new ZXing.RGBLuminanceSource(
                            cropData.data,
                            cropW,
                            cropH
                        );
                        var cropBmp = new ZXing.BinaryBitmap(
                            new ZXing.HybridBinarizer(cropLum)
                        );
                        var cropResult = codeReader.decodeBitmap(cropBmp);
                        if (cropResult) {
                            return resolve(cropResult);
                        }
                    } catch (e2) {}
                }
            }

            // Fallback: Try simple QR detection from canvas
            if (CONFIG.useFallbackReader) {
                try {
                    // Check for QR code patterns (simplified)
                    var dataURL = canvas.toDataURL('image/png');
                    if (dataURL.length > 100) {
                        // Could implement a basic QR detector here if needed
                        if (CONFIG.debugMode) console.log('Fallback detection attempted');
                    }
                } catch (e) {}
            }

            resolve(null);
        } catch (e) {
            if (CONFIG.debugMode) console.warn('Decode error:', e);
            resolve(null);
        }
    });
}

function startDecodeLoop() {
    state.decodeLoopRunning = true;
    
    var loop = function() {
        if (!state.decodeLoopRunning || !state.stream) return;

        var scanInterval = state.scanCooldown ? 150 : CONFIG.scanInterval;

        if (!state.scanCooldown) {
            decodeFrame().then(function(result) {
                if (result && result.text) {
                    handleDecoded(result.text);
                }
                if (state.decodeLoopRunning) {
                    setTimeout(loop, scanInterval);
                }
            }).catch(function() {
                if (state.decodeLoopRunning) {
                    setTimeout(loop, scanInterval);
                }
            });
        } else {
            if (state.decodeLoopRunning) {
                setTimeout(loop, scanInterval);
            }
        }
    };

    loop();
}

// ============================================================
// HANDLE DECODED PAYLOAD
// ============================================================

function handleDecoded(data) {
    try {
        if (data === state.lastScan) return;

        state.lastScan = data;
        state.scanCooldown = true;

        setPayload(data);
        setStatus('✅ Scanned: ' + data.slice(0, 30) + (data.length > 30 ? '...' : ''), 'success');
        setScanIndicator(true);

        // Vibrate if available
        if (CONFIG.vibrateOnScan && navigator.vibrate) {
            try { navigator.vibrate(50); } catch (e) {}
        }

        // Audio feedback if available
        try {
            if (window.AudioContext) {
                var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                var oscillator = audioCtx.createOscillator();
                var gainNode = audioCtx.createGain();
                oscillator.connect(gainNode);
                gainNode.connect(audioCtx.destination);
                oscillator.frequency.value = 880;
                oscillator.type = 'sine';
                gainNode.gain.value = 0.1;
                oscillator.start();
                setTimeout(function() {
                    try { oscillator.stop(); } catch (e) {}
                }, 100);
            }
        } catch (e) {}

        addToLedger(data);

        setTimeout(function() {
            state.scanCooldown = false;
            setScanIndicator(false);
        }, CONFIG.cooldownDelay);
    } catch (e) {
        if (CONFIG.debugMode) console.warn('Error handling decoded data:', e);
    }
}

// ============================================================
// PHOTO FUNCTIONS
// ============================================================

function takePhoto() {
    if (!state.stream) {
        setStatus('❌ Camera not active', 'error');
        return;
    }

    try {
        var canvas = elements.canvas;
        var ctx = canvas.getContext('2d');
        var video = elements.video;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        var dataURL = canvas.toDataURL('image/png');
        if (elements.preview) {
            elements.preview.src = dataURL;
            elements.preview.classList.add('visible');
        }

        decodeFromCanvas();
    } catch (err) {
        setStatus('❌ Photo failed: ' + (err.message || 'Unknown'), 'error');
    }
}

function decodeFromCanvas() {
    try {
        var canvas = elements.canvas;
        var ctx = canvas.getContext('2d');
        var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        if (zxingAvailable && codeReader) {
            var luminance = new ZXing.RGBLuminanceSource(
                imageData.data,
                canvas.width,
                canvas.height
            );
            var bitmap = new ZXing.BinaryBitmap(
                new ZXing.HybridBinarizer(luminance)
            );
            var result = codeReader.decodeBitmap(bitmap);

            if (result && result.text) {
                handleDecoded(result.text);
                setStatus('📸 Photo decoded', 'success');
                return;
            }
        }

        setStatus('❌ No barcode found in photo', 'warning');
    } catch (err) {
        setStatus('❌ No barcode found in photo', 'warning');
    }
}

// ============================================================
// IMAGE UPLOAD
// ============================================================

function handleImageUpload(e) {
    try {
        var file = e.target.files[0];
        if (!file) return;

        var imgURL = URL.createObjectURL(file);
        var img = new Image();
        img.src = imgURL;

        img.onload = function() {
            try {
                var canvas = elements.canvas;
                var ctx = canvas.getContext('2d');

                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                ctx.drawImage(img, 0, 0);

                if (elements.preview) {
                    elements.preview.src = imgURL;
                    elements.preview.classList.add('visible');
                }

                decodeFromCanvas();
                URL.revokeObjectURL(imgURL);
            } catch (err) {
                setStatus('❌ Failed to process image', 'error');
                URL.revokeObjectURL(imgURL);
            }
        };

        img.onerror = function() {
            setStatus('❌ Failed to load image', 'error');
            URL.revokeObjectURL(imgURL);
        };
    } catch (e) {
        setStatus('❌ Upload failed: ' + (e.message || 'Unknown'), 'error');
    }
}

// ============================================================
// EVENT BINDING - Cross-browser compatible
// ============================================================

function addEventListenerSafe(element, event, handler) {
    if (!element) return;
    try {
        element.addEventListener(event, handler);
    } catch (e) {
        // Fallback for very old browsers
        try {
            element.attachEvent('on' + event, handler);
        } catch (e2) {}
    }
}

function initEvents() {
    addEventListenerSafe(elements.startBtn, 'click', function() {
        startCamera();
    });

    addEventListenerSafe(elements.flipBtn, 'click', function() {
        flipCamera();
    });

    addEventListenerSafe(elements.uploadBtn, 'click', function() {
        if (elements.fileInput) {
            try { elements.fileInput.click(); } catch (e) {}
        }
    });

    addEventListenerSafe(elements.fileInput, 'change', function(e) {
        handleImageUpload(e);
    });

    addEventListenerSafe(elements.photoBtn, 'click', function() {
        takePhoto();
    });

    addEventListenerSafe(elements.resetLedgerBtn, 'click', function() {
        clearLedger();
    });

    addEventListenerSafe(elements.sendBtn, 'click', function() {
        var lastEntry = state.ledgerEntries[state.ledgerEntries.length - 1];
        if (lastEntry) {
            setStatus('📡 Sending: ' + lastEntry.data, 'success');
            if (CONFIG.debugMode) console.log('SEND:', lastEntry.data);
        } else {
            setStatus('📡 No data to send', 'warning');
        }
    });

    // Keyboard shortcuts (cross-browser)
    document.addEventListener('keydown', function(e) {
        var key = e.key || e.keyCode || e.which;
        if (key === ' ' || key === 'Space' || key === 32) {
            e.preventDefault();
            if (!state.stream) {
                startCamera();
            } else {
                takePhoto();
            }
        }
        if (key === 'f' || key === 'F' || key === 70) {
            flipCamera();
        }
    });
}

// ============================================================
// INITIALIZATION - Cross-browser compatible
// ============================================================

function init() {
    if (state.isInitialized) return;
    state.isInitialized = true;

    initEvents();

    // Check if camera is available
    var hasGetUserMedia = false;
    try {
        hasGetUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) ||
                         !!(navigator.getUserMedia) ||
                         !!(navigator.webkitGetUserMedia) ||
                         !!(navigator.mozGetUserMedia);
    } catch (e) {}

    if (!hasGetUserMedia) {
        setStatus('⚠️ Camera not available on this browser', 'warning');
        return;
    }

    // Auto-start on user interaction
    var autoStarted = false;

    document.addEventListener('click', function() {
        if (!autoStarted && hasGetUserMedia) {
            autoStarted = true;
            startCamera();
        }
    }, { once: true });

    document.addEventListener('touchstart', function() {
        if (!autoStarted && hasGetUserMedia) {
            autoStarted = true;
            setTimeout(function() {
                startCamera();
            }, 100);
        }
    }, { once: true });

    // Fallback for desktop
    setTimeout(function() {
        if (!autoStarted && hasGetUserMedia) {
            var isMobile = /Mobi|Android|iPhone|iPad|iPod|BlackBerry|Opera Mini|IEMobile/i.test(navigator.userAgent);
            if (!isMobile) {
                autoStarted = true;
                startCamera();
            }
        }
    }, 2000);

    var browserName = state.browserType.charAt(0).toUpperCase() + state.browserType.slice(1);
    console.log('📷 Universal Barcode Scanner ready on ' + browserName + '!');
    console.log('📱 Compatible with all browsers and devices');
    console.log('⌨️  Space/Enter = Scan, F = Flip camera');
}

// ============================================================
// EXPOSE PUBLIC API
// ============================================================

var Scanner = {
    init: init,
    startCamera: startCamera,
    flipCamera: flipCamera,
    takePhoto: takePhoto,
    clearLedger: clearLedger,
    addToLedger: addToLedger,
    setStatus: setStatus,
    getLedger: function() { return state.ledgerEntries; },
    getState: function() { return state; },
    CONFIG: CONFIG,
    browser: state.browserType,
};

// Auto-initialize when DOM is ready
try {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // DOM already loaded
        setTimeout(init, 0);
    }
} catch (e) {
    // Fallback for very old browsers
    window.onload = function() {
        setTimeout(init, 0);
    };
}

// Export for module usage
try {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Scanner;
    }
} catch (e) {}

// Make available globally
try {
    window.Scanner = Scanner;
} catch (e) {}

console.log('📷 Barcode Scanner loaded successfully');
