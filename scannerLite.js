// scannerLite.js
(function () {
  var video = null;
  var canvas = null;
  var ctx = null;
  var statusEl = null;
  var payloadEl = null;
  var stream = null;
  var scanning = false;

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg;
  }

  function isLegacyDevice() {
    var ua = navigator.userAgent || "";
    var iOS12 = /iPhone OS 12_/i.test(ua);
    var oldSafari = /Version\/12|Version\/11|Version\/10/i.test(ua);
    var raspberry = /Raspberry|armv7l|armv6l/i.test(ua);
    return iOS12 || oldSafari || raspberry;
  }

  function init() {
    video = document.getElementById('video');
    canvas = document.getElementById('canvas');
    statusEl = document.getElementById('status');
    payloadEl = document.getElementById('payload');

    if (!canvas || !video) {
      return;
    }
    ctx = canvas.getContext('2d');

    var startBtn = document.getElementById('startBtn');
    var stopBtn = document.getElementById('stopBtn');
    var uploadBtn = document.getElementById('uploadBtn');
    var fileInput = document.getElementById('fileInput');
    var copyBtn = document.getElementById('copyBtn');
    var clearBtn = document.getElementById('clearBtn');

    if (startBtn) startBtn.onclick = startCamera;
    if (stopBtn) stopBtn.onclick = stopCamera;
    if (uploadBtn && fileInput) {
      uploadBtn.onclick = function () { fileInput.click(); };
      fileInput.onchange = handleFileUpload;
    }
    if (copyBtn) copyBtn.onclick = copyPayload;
    if (clearBtn) clearBtn.onclick = clearPayload;

    if (isLegacyDevice()) {
      setStatus('🟡 Legacy Lite Scanner (jsQR)');
      showToast('Legacy mode enabled (iOS 12 / Pi)');
    } else {
      setStatus('🟢 This Lite scanner also works on modern devices');
    }
  }

  function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus('❌ Camera not supported');
      return;
    }

    var constraints = {
      video: {
        facingMode: 'environment'
      }
    };

    navigator.mediaDevices.getUserMedia(constraints)
      .then(function (s) {
        stream = s;
        video.srcObject = stream;
        video.play();
        scanning = true;
        setStatus('📷 Camera active (Lite)');
        scanLoop();
      })
      .catch(function (err) {
        setStatus('❌ Camera error: ' + err.message);
      });
  }

  function stopCamera() {
    scanning = false;
    if (stream && stream.getTracks) {
      var tracks = stream.getTracks();
      for (var i = 0; i < tracks.length; i++) {
        tracks[i].stop();
      }
    }
    stream = null;
    setStatus('⏹️ Stopped');
  }

  function scanLoop() {
    if (!scanning) return;
    if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
      setTimeout(scanLoop, 300);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      var code = jsQR(imageData.data, canvas.width, canvas.height);
      if (code && code.data) {
        payloadEl.textContent = code.data;
        setStatus('✅ QR decoded (Lite)');
        // simple cooldown
        scanning = false;
        setTimeout(function () {
          scanning = true;
          scanLoop();
        }, 1500);
      } else {
        setStatus('🔍 Scanning…');
        setTimeout(scanLoop, 300);
      }
    } catch (e) {
      setStatus('❌ Decode error: ' + e.message);
      setTimeout(scanLoop, 500);
    }
  }

  function handleFileUpload(e) {
    var file = e.target.files[0];
    if (!file) return;

    setStatus('📁 Loading image…');

    var img = new Image();
    img.onload = function () {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0, img.width, img.height);
      try {
        var imageData = ctx.getImageData(0, 0, img.width, img.height);
        var code = jsQR(imageData.data, img.width, img.height);
        if (code && code.data) {
          payloadEl.textContent = code.data;
          setStatus('✅ QR decoded from image');
        } else {
          setStatus('❌ No QR found in image');
        }
      } catch (err) {
        setStatus('❌ Decode error: ' + err.message);
      }
    };
    img.onerror = function () {
      setStatus('❌ Image load failed');
    };
    img.src = URL.createObjectURL(file);
  }

  function copyPayload() {
    var text = payloadEl ? payloadEl.textContent : '';
    if (!text) {
      setStatus('Nothing to copy');
      return;
    }
    try {
      navigator.clipboard.writeText(text).then(function () {
        setStatus('📋 Copied');
      }).catch(function () {
        setStatus('📋 Copy failed');
      });
    } catch (e) {
      setStatus('📋 Copy not supported');
    }
  }

  function clearPayload() {
    if (payloadEl) payloadEl.textContent = '';
    setStatus('🧹 Cleared');
  }

  // bootstrap
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
