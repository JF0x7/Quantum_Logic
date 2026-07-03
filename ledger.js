// ============================================================================
//  SAFARI / iPHONE 6 COMPATIBILITY HELPERS
// ============================================================================

function safeEncode(str) {
    try {
        if (window.TextEncoder) return new TextEncoder().encode(str);
        var utf8 = [];
        for (var i = 0; i < str.length; i++) {
            var c = str.charCodeAt(i);
            if (c < 128) utf8.push(c);
            else if (c < 2048) {
                utf8.push((c >> 6) | 192);
                utf8.push((c & 63) | 128);
            } else {
                utf8.push((c >> 12) | 224);
                utf8.push(((c >> 6) & 63) | 128);
                utf8.push((c & 63) | 128);
            }
        }
        return new Uint8Array(utf8);
    } catch (_) {
        return new Uint8Array([]);
    }
}

function safeSHA256(str) {
    try {
        var data = safeEncode(str);
        if (crypto.subtle && crypto.subtle.digest) {
            return crypto.subtle.digest("SHA-256", data).then(function(hash) {
                return Array.from(new Uint8Array(hash))
                    .map(function(b) { return b.toString(16).padStart(2, "0"); })
                    .join("");
            });
        }
    } catch (_) {}
    return Promise.resolve(sha256Fallback(str));
}

function sha256Fallback(ascii) {
    function rightRotate(value, amount) {
        return (value >>> amount) | (value << (32 - amount));
    }
    var mathPow = Math.pow;
    var maxWord = mathPow(2, 32);
    var result = "";
    var words = [];
    var asciiBitLength = ascii.length * 8;
    var hash = sha256Fallback.h = sha256Fallback.h || [];
    var k = sha256Fallback.k = sha256Fallback.k || [];
    var primeCounter = k.length;

    function isPrime(n) {
        var sqrtN = Math.sqrt(n);
        for (var i = 2; i <= sqrtN; i++) {
            if (n % i === 0) return false;
        }
        return true;
    }

    while (primeCounter < 64) {
        var candidate = primeCounter + 2;
        while (!isPrime(candidate)) candidate++;
        hash[primeCounter] = (Math.pow(candidate, 0.5) * maxWord) | 0;
        k[primeCounter] = (Math.pow(candidate, 1/3) * maxWord) | 0;
        primeCounter++;
    }

    ascii += "\x80";
    while ((ascii.length % 64) !== 56) ascii += "\x00";

    for (var i = 0; i < ascii.length; i++) {
        words[i >> 2] |= ascii.charCodeAt(i) << ((3 - (i % 4)) * 8);
    }

    words.push((asciiBitLength / maxWord) | 0);
    words.push(asciiBitLength | 0);

    for (var j = 0; j < words.length; ) {
        var w = words.slice(j, j += 16);
        var oldHash = hash.slice(0);
        for (var i = 16; i < 64; i++) {
            var a = w[i - 15];
            var b = w[i - 2];
            w[i] = (((rightRotate(a, 7) ^ rightRotate(a, 18) ^ (a >>> 3)) +
                w[i - 7] +
                (rightRotate(b, 17) ^ rightRotate(b, 19) ^ (b >>> 10))) | 0);
        }
        var a = oldHash[0], b = oldHash[1], c = oldHash[2], d = oldHash[3];
        var e = oldHash[4], f = oldHash[5], g = oldHash[6], h = oldHash[7];

        for (var i = 0; i < 64; i++) {
            var t1 = h +
                (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
                ((e & f) ^ (~e & g)) +
                k[i] +
                w[i];
            var t2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
                ((a & b) ^ (a & c) ^ (b & c));
            h = g;
            g = f;
            f = e;
            e = (d + t1) | 0;
            d = c;
            c = b;
            b = a;
            a = (t1 + t2) | 0;
        }
        hash[0] = (hash[0] + a) | 0;
        hash[1] = (hash[1] + b) | 0;
        hash[2] = (hash[2] + c) | 0;
        hash[3] = (hash[3] + d) | 0;
        hash[4] = (hash[4] + e) | 0;
        hash[5] = (hash[5] + f) | 0;
        hash[6] = (hash[6] + g) | 0;
        hash[7] = (hash[7] + h) | 0;
    }

    for (var i = 0; i < hash.length; i++) {
        result += (hash[i] >>> 0).toString(16).padStart(8, "0");
    }
    return result;
}

// ============================================================================
//  QUANTUM LEDGER WITH Q-NETWORK
// ============================================================================

function QuantumLedger(containerId) {
    this.container = document.getElementById(containerId);
    this.entries = [];
    this.qai = null;
    this.stats = {
        totalEntries: 0,
        qNetworkNodes: 0
    };
    if (!this.container) {
        console.warn('Ledger container not found');
    }
}

QuantumLedger.prototype.setQAI = function(qaiInstance) {
    this.qai = qaiInstance;
};

QuantumLedger.prototype.analyzePayload = function(payload) {
    var trimmed = payload.trim();
    var length = trimmed.length;
    var entropy = this.calculateEntropy(trimmed);

    var isURL = /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(trimmed);
    var isJSON = this.tryParseJSON(trimmed);
    var isHex = /^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0;
    var isBase64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(trimmed);
    var isMorse = /^[.\-/\s]+$/.test(trimmed) && /[.\-]/.test(trimmed);
    var isDDN = /DDN_ENC::/.test(trimmed);
    var isQTUM = /QTUM_/.test(trimmed);

    var classification = "UNKNOWN SIGNAL";
    if (isURL) classification = "URL";
    else if (isJSON) classification = "JSON OBJECT";
    else if (isHex) classification = "HEX STRING";
    else if (isBase64) classification = "BASE64 ENCODED";
    else if (isMorse) classification = "MORSE CODE";
    else if (isDDN) classification = "DDN ENCRYPTED";
    else if (isQTUM) classification = "QTUM SIGNAL";
    else if (length < 8) classification = "SHORT CODE";

    var charset = this.detectCharset(trimmed);
    var entropyClass = this.entropyClass(entropy);
    var signalStrength = this.signalStrength(length, entropy);
    var decodedPreview = this.tryDecode(trimmed);

    var networkType = this.detectNetwork(trimmed);

    return {
        length: length,
        entropy: entropy,
        classification: classification,
        charset: charset,
        entropyClass: entropyClass,
        signalStrength: signalStrength,
        decodedPreview: decodedPreview,
        networkType: networkType
    };
};

QuantumLedger.prototype.detectCharset = function(str) {
    if (/^[\x00-\x7F]+$/.test(str)) return "ASCII";
    if (/^[\x00-\xFF]+$/.test(str)) return "Extended ASCII";
    return "Unicode / Binary-like";
};

QuantumLedger.prototype.entropyClass = function(entropy) {
    var e = parseFloat(entropy);
    if (e < 3) return "Low";
    if (e < 4) return "Medium";
    return "High";
};

QuantumLedger.prototype.signalStrength = function(length, entropy) {
    var score = length * 0.2 + parseFloat(entropy) * 4;
    if (score < 20) return "Weak";
    if (score < 40) return "Moderate";
    return "Strong";
};

QuantumLedger.prototype.tryDecode = function(str) {
    try {
        if (/^[0-9a-fA-F]+$/.test(str) && str.length % 2 === 0) {
            var bytes = str.match(/.{2}/g).map(function(h) { return parseInt(h, 16); });
            return String.fromCharCode.apply(null, bytes).slice(0, 60);
        }
        if (/^[A-Za-z0-9+/=]+$/.test(str)) {
            return atob(str).slice(0, 60);
        }
        if (/^[.\-/\s]+$/.test(str)) {
            return this.morseDecode(str).slice(0, 60);
        }
    } catch (_) {}
    return "n/a";
};

QuantumLedger.prototype.detectNetwork = function(str) {
    if (/QTUM_/.test(str)) return 'QTUM';
    if (/DDN_ENC::/.test(str)) return 'DDN';
    if (/^0x[a-fA-F0-9]{40}$/.test(str)) return 'ETH';
    if (/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(str)) return 'BTC';
    if (/^https?:\/\//.test(str)) return 'WEB';
    if (/^[.\-/\s]+$/.test(str) && /[.\-]/.test(str)) return 'MORSE';
    return 'UNKNOWN';
};

QuantumLedger.prototype.morseDecode = function(str) {
    var morseMap = {
        '.-': 'A', '-...': 'B', '-.-.': 'C', '-..': 'D', '.': 'E',
        '..-.': 'F', '--.': 'G', '....': 'H', '..': 'I', '.---': 'J',
        '-.-': 'K', '.-..': 'L', '--': 'M', '-.': 'N', '---': 'O',
        '.--.': 'P', '--.-': 'Q', '.-.': 'R', '...': 'S', '-': 'T',
        '..-': 'U', '...-': 'V', '.--': 'W', '-..-': 'X', '-.--': 'Y',
        '--..': 'Z', '-----': '0', '.----': '1', '..---': '2',
        '...--': '3', '....-': '4', '.....': '5', '-....': '6',
        '--...': '7', '---..': '8', '----.': '9'
    };
    try {
        var words = str.split('/');
        var result = [];
        for (var i = 0; i < words.length; i++) {
            var letters = words[i].trim().split(' ');
            var decodedWord = '';
            for (var j = 0; j < letters.length; j++) {
                if (letters[j]) {
                    decodedWord += morseMap[letters[j]] || '?';
                }
            }
            result.push(decodedWord);
        }
        return result.join(' ');
    } catch (_) {
        return 'Morse decode error';
    }
};

QuantumLedger.prototype.calculateEntropy = function(str) {
    if (!str) return "0.00";
    var map = {};
    for (var i = 0; i < str.length; i++) {
        var char = str[i];
        map[char] = (map[char] || 0) + 1;
    }
    var entropy = 0;
    var len = str.length;
    for (var char in map) {
        if (map.hasOwnProperty(char)) {
            var p = map[char] / len;
            entropy -= p * Math.log2(p);
        }
    }
    return entropy.toFixed(2);
};

QuantumLedger.prototype.tryParseJSON = function(str) {
    if (!str.startsWith("{") && !str.startsWith("[")) return false;
    try {
        JSON.parse(str);
        return true;
    } catch (_) {
        return false;
    }
};

QuantumLedger.prototype.addEntry = function(payload, tag, extraMeta) {
    if (!this.container) return;
    tag = tag || "SCAN";
    extraMeta = extraMeta || {};

    var self = this;
    var meta = this.analyzePayload(payload);

    safeSHA256(payload).then(function(shaFull) {
        var hash = shaFull.slice(0, 16);
        var time = new Date().toLocaleString();

        var item = document.createElement("div");
        item.className = "ledgerItem";
        item.setAttribute('data-network', meta.networkType);
        item.setAttribute('data-tag', tag);

        var payloadEl = document.createElement("div");
        payloadEl.className = "ledgerPayload";
        payloadEl.textContent = payload;

        var metaEl = document.createElement("div");
        metaEl.className = "ledgerMeta";
        metaEl.innerHTML =
            '<span><strong>Len:</strong> ' + meta.length + '</span>' +
            '<span><strong>Entropy:</strong> ' + meta.entropy + '</span>' +
            '<span><strong>Type:</strong> ' + meta.classification + '</span>' +
            '<span><strong>Network:</strong> ' + meta.networkType + '</span>' +
            '<span><strong>Charset:</strong> ' + meta.charset + '</span>' +
            '<span><strong>Class:</strong> ' + meta.entropyClass + '</span>' +
            '<span><strong>Strength:</strong> ' + meta.signalStrength + '</span>' +
            '<span><strong>Decoded:</strong> ' + meta.decodedPreview + '</span>' +
            '<span><strong>Fingerprint:</strong> ' + hash + '</span>';

        var footerEl = document.createElement("div");
        footerEl.className = "ledgerFooter";

        var tagEl = document.createElement("span");
        tagEl.className = "ledgerTag tag-" + tag.toLowerCase();
        tagEl.textContent = tag;

        var timeEl = document.createElement("span");
        timeEl.className = "ledgerTime";
        timeEl.textContent = time;

        // Q-Network Actions
        var actionsEl = document.createElement("div");
        actionsEl.className = "ledgerActions";
        actionsEl.innerHTML =
            '<button class="ledger-action-btn ledger-copy-btn" title="Copy">📋</button>' +
            '<button class="ledger-action-btn ledger-share-btn" title="Share">📤</button>' +
            '<button class="ledger-action-btn ledger-search-btn" title="Search">🔍</button>';

        // Add event listeners to action buttons
        actionsEl.querySelector('.ledger-copy-btn').addEventListener('click', function(e) {
            e.stopPropagation();
            self.copyToClipboard(payload);
        });

        actionsEl.querySelector('.ledger-share-btn').addEventListener('click', function(e) {
            e.stopPropagation();
            self.shareData(payload);
        });

        actionsEl.querySelector('.ledger-search-btn').addEventListener('click', function(e) {
            e.stopPropagation();
            self.searchData(payload);
        });

        footerEl.appendChild(tagEl);
        footerEl.appendChild(timeEl);
        footerEl.appendChild(actionsEl);

        item.appendChild(payloadEl);
        item.appendChild(metaEl);
        item.appendChild(footerEl);

        self.container.prepend(item);
        self.entries.push({ payload: payload, tag: tag, meta: meta, timestamp: time });
        self.stats.totalEntries++;
        self.updateStats();

        // Add to Q-Network if QAI is available
        if (self.qai && typeof self.qai.qNetwork !== 'undefined') {
            self.qai.qNetwork.addNode({
                type: meta.classification,
                network: meta.networkType,
                payload: payload.slice(0, 50),
                entropy: meta.entropy
            });
            self.stats.qNetworkNodes = self.qai.qNetwork.nodes.length;
        }
    });
};

QuantumLedger.prototype.copyToClipboard = function(text) {
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function() {
                self.showLedgerFeedback('📋 Copied!');
            }).catch(function() {
                self.fallbackCopy(text);
            });
        } else {
            self.fallbackCopy(text);
        }
    } catch (_) {
        self.fallbackCopy(text);
    }
};

QuantumLedger.prototype.fallbackCopy = function(text) {
    try {
        var textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        this.showLedgerFeedback('📋 Copied!');
    } catch (_) {
        this.showLedgerFeedback('❌ Copy failed');
    }
};

QuantumLedger.prototype.shareData = function(text) {
    try {
        if (navigator.share) {
            navigator.share({
                title: 'QTUM Scan Result',
                text: text
            }).catch(function() {});
        } else {
            this.copyToClipboard(text);
            this.showLedgerFeedback('📤 Shared (copied)');
        }
    } catch (_) {
        this.copyToClipboard(text);
    }
};

QuantumLedger.prototype.searchData = function(text) {
    try {
        var isUrl = /^https?:\/\/[^\s]+/i.test(text);
        if (isUrl) {
            window.open(text, '_blank');
        } else {
            window.open('https://www.google.com/search?q=' + encodeURIComponent(text), '_blank');
        }
    } catch (_) {}
};

QuantumLedger.prototype.showLedgerFeedback = function(message) {
    var feedback = document.getElementById('ledgerFeedback');
    if (!feedback) {
        feedback = document.createElement('div');
        feedback.id = 'ledgerFeedback';
        feedback.style.cssText = 'position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); ' +
            'background: #1f2937; color: #e5e7eb; padding: 10px 20px; border-radius: 10px; ' +
            'z-index: 10000; font-size: 0.9rem; border: 1px solid #374151; transition: opacity 0.3s ease;';
        document.body.appendChild(feedback);
    }
    feedback.textContent = message;
    feedback.style.opacity = '1';
    setTimeout(function() {
        feedback.style.opacity = '0';
    }, 2000);
};

QuantumLedger.prototype.updateStats = function() {
    var countEl = document.getElementById('ledgerCount');
    var qaiEl = document.getElementById('ledgerQAI');
    if (countEl) {
        countEl.textContent = this.stats.totalEntries + ' entries' +
            (this.stats.qNetworkNodes ? ' | Q-Network: ' + this.stats.qNetworkNodes + ' nodes' : '');
    }
    if (qaiEl) {
        qaiEl.textContent = '🧠 QAI ' + (this.qai ? 'Active' : 'Inactive');
    }
};

QuantumLedger.prototype.clear = function() {
    if (!this.container) return;
    if (confirm("Clear all ledger entries?")) {
        this.container.innerHTML = "";
        this.entries = [];
        this.stats.totalEntries = 0;
        this.updateStats();
        this.showLedgerFeedback('🗑️ Ledger cleared');
    }
};

QuantumLedger.prototype.copyAll = function() {
    var texts = [];
    var items = this.container.querySelectorAll('.ledgerPayload');
    for (var i = 0; i < items.length; i++) {
        texts.push(items[i].textContent);
    }
    if (texts.length === 0) {
        this.showLedgerFeedback('📋 Nothing to copy');
        return;
    }
    var allText = texts.join('\n\n---\n\n');
    this.copyToClipboard(allText);
};

QuantumLedger.prototype.shareAll = function() {
    var texts = [];
    var items = this.container.querySelectorAll('.ledgerPayload');
    for (var i = 0; i < items.length; i++) {
        texts.push(items[i].textContent);
    }
    if (texts.length === 0) {
        this.showLedgerFeedback('📤 Nothing to share');
        return;
    }
    var allText = 'QTUM Scan Results:\n\n' + texts.join('\n\n---\n\n');
    this.shareData(allText);
};

QuantumLedger.prototype.searchAll = function() {
    var texts = [];
    var items = this.container.querySelectorAll('.ledgerPayload');
    for (var i = 0; i < items.length; i++) {
        texts.push(items[i].textContent);
    }
    if (texts.length === 0) {
        this.showLedgerFeedback('🔍 Nothing to search');
        return;
    }
    var query = texts.join(' ');
    window.open('https://www.google.com/search?q=' + encodeURIComponent(query), '_blank');
};

// ============================================================================
//  AZTEC DB
// ============================================================================

var AztecDB = {
    meta: {
        version: "1.1",
        updated: "2026-07-03",
        engine: "QAI-AZTEC-DDN",
        checksum: "QLOGIC_44"
    },
    registry: [
        {
            id: "AZTEC_ENC::JF0X7::004B",
            type: "aztec",
            seq: 77,
            chk: "OK",
            frame: "QLOGIC_44",
            payload: {
                enc: "ENC::QAI-5521::A9F2",
                ddn: "DDN_ENC::A9F2::XOR5A_REV_CAESAR",
                morse: "- .... .- -. -.- ... / -.-. --- -- .. -. --."
            }
        }
    ],
    decoders: {
        aztec: function(data) { return "Aztec decode (DB): " + data + " • SHeesh!"; },
        ddn: function(str) {
            try {
                var r = str.split("").map(function(c) { return String.fromCharCode(c.charCodeAt(0) ^ 0x5A); }).join("");
                r = r.split("").reverse().join("");
                return r.replace(/DDN_ENC::/g, "").replace(/::DDN_END/g, "");
            } catch (_) {
                return "DDN decrypt error";
            }
        },
        morse: function(str) {
            var map = {
                ".-": "A", "-...": "B", "-.-.": "C", "-..": "D", ".": "E",
                "..-.": "F", "--.": "G", "....": "H", "..": "I", ".---": "J",
                "-.-": "K", ".-..": "L", "--": "M", "-.": "N", "---": "O",
                ".--.": "P", "--.-": "Q", ".-.": "R", "...": "S", "-": "T",
                "..-": "U", "...-": "V", ".--": "W", "-..-": "X", "-.--": "Y",
                "--..": "Z"
            };
            try {
                return str.trim().split("/").map(function(w) {
                    return w.trim().split(/\s+/).map(function(l) { return map[l] || "?"; }).join("");
                }).join(" ");
            } catch (_) {
                return "Morse decode error";
            }
        }
    }
};