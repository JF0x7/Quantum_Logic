// ============================================================================
//  PREDECLARE AZTECDB (fixes QAI analysis failed)
// ============================================================================
let AztecDB;

// ============================================================================
//  QUANTUM LEDGER (TOP)
// ============================================================================

class QuantumLedger {

    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.warn(`Ledger container #${containerId} not found.`);
        }
        this.entries = []; // Store entries for export
    }

    // -------------------------------------------------------------
    // MAIN ANALYSIS
    // -------------------------------------------------------------
    analyzePayload(payload) {
        const trimmed = payload.trim();
        const length = trimmed.length;
        const entropy = this.calculateEntropy(trimmed);

        const isURL = /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(trimmed);
        const isJSON = this.tryParseJSON(trimmed);
        const isHex = /^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0;
        const isBase64 =
            /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(trimmed) &&
            trimmed.length >= 4 &&
            (/[+/=]/.test(trimmed) || entropy > 4.5);
        const isMorse = /^[.\-/\s]+$/.test(trimmed) && /[.\-]/.test(trimmed);

        let classification = "UNKNOWN SIGNAL";
        if (isURL) classification = "URL";
        else if (isJSON) classification = "JSON OBJECT";
        else if (isHex) classification = "HEX STRING";
        else if (isBase64) classification = "BASE64 ENCODED";
        else if (isMorse) classification = "MORSE CODE";
        else if (length < 8) classification = "SHORT CODE";
        else if (length > 80) classification = "LONG FORM DATA";

        const charset = this.detectCharset(trimmed);
        const entropyClass = this.entropyClass(entropy);
        const signalStrength = this.signalStrength(length, entropy);
        const decodedPreview = this.tryDecode(trimmed);
        const hashFingerprint = this.sha256Fingerprint(trimmed);

        const rot13 = this.rot13(trimmed);
        const aztec = this.aztecDecode(trimmed);
        const altbash = this.altBashDecode(trimmed);
        const shaFullPromise = this.sha256Full(trimmed);
        const signalTypes = this.detectSignalTypes(trimmed);
        const signalLocation = this.detectSignalLocation(trimmed);
        const clamShell = this.clamShellDecrypt(trimmed);
        const ddnDecrypt = this.ddnDecrypt(trimmed);
        const morseDecode = this.morseDecode(trimmed);
        const qNotes = this.generateQNotes(trimmed, classification, entropy);

        return {
            length,
            entropy,
            classification,
            charset,
            entropyClass,
            signalStrength,
            decodedPreview,
            hashFingerprint,

            rot13,
            aztec,
            altbash,
            shaFullPromise,
            clamShell,
            ddnDecrypt,
            morseDecode,
            signalTypes,
            signalLocation,
            qNotes
        };
    }

    // -------------------------------------------------------------
    // CHARACTER SET
    // -------------------------------------------------------------
    detectCharset(str) {
        if (/^[\x00-\x7F]+$/.test(str)) return "ASCII";
        if (/^[\x00-\xFF]+$/.test(str)) return "Extended ASCII";
        return "Unicode / Binary-like";
    }

    // -------------------------------------------------------------
    // ENTROPY CLASS
    // -------------------------------------------------------------
    entropyClass(entropy) {
        const e = parseFloat(entropy);
        if (e < 3) return "Low";
        if (e < 4) return "Medium";
        return "High";
    }

    // -------------------------------------------------------------
    // SIGNAL STRENGTH
    // -------------------------------------------------------------
    signalStrength(length, entropy) {
        const score = length * 0.2 + parseFloat(entropy) * 4;
        if (score < 20) return "Weak";
        if (score < 40) return "Moderate";
        return "Strong";
    }

    // -------------------------------------------------------------
    // BASIC DECODERS
    // -------------------------------------------------------------
    tryDecode(str) {
        try {
            if (/^[0-9a-fA-F]+$/.test(str) && str.length % 2 === 0) {
                const bytes = str.match(/.{2}/g).map(h => parseInt(h, 16));
                return String.fromCharCode(...bytes).slice(0, 60);
            }
            if (/^[A-Za-z0-9+/=]+$/.test(str)) {
                return atob(str).slice(0, 60);
            }
            if (/^[.\-/\s]+$/.test(str)) {
                return this.morseDecode(str).slice(0, 60);
            }
        } catch {}
        return "n/a";
    }

    // -------------------------------------------------------------
    // SHA256 SHORT
    // -------------------------------------------------------------
    sha256Fingerprint(str) {
        try {
            const buffer = new TextEncoder().encode(str);
            return crypto.subtle.digest("SHA-256", buffer).then(hash => {
                const hex = Array.from(new Uint8Array(hash))
                    .map(b => b.toString(16).padStart(2, "0"))
                    .join("");
                return hex.slice(0, 16);
            });
        } catch {
            return Promise.resolve("n/a");
        }
    }

    // -------------------------------------------------------------
    // SHA256 FULL
    // -------------------------------------------------------------
    async sha256Full(str) {
        try {
            const buffer = new TextEncoder().encode(str);
            const hash = await crypto.subtle.digest("SHA-256", buffer);
            return Array.from(new Uint8Array(hash))
                .map(b => b.toString(16).padStart(2, "0"))
                .join("");
        } catch {
            return "n/a";
        }
    }

    // -------------------------------------------------------------
    // ROT13
    // -------------------------------------------------------------
    rot13(str) {
        return str.replace(/[A-Za-z]/g, c =>
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".charAt(
                "NOPQRSTUVWXYZABCDEFGHIJKLMnopqrstuvwxyzabcdefghijklm".indexOf(c)
            )
        );
    }

    // -------------------------------------------------------------
    // ALT-BASH
    // -------------------------------------------------------------
    altBashDecode(str) {
        try {
            if (/^[A-Za-z0-9+/=]+$/.test(str)) return atob(str);
            if (/^[0-9a-fA-F]+$/.test(str) && str.length % 2 === 0) {
                const bytes = str.match(/.{2}/g).map(h => parseInt(h, 16));
                return String.fromCharCode(...bytes);
            }
            return decodeURIComponent(str);
        } catch {
            return "n/a";
        }
    }

    // -------------------------------------------------------------
    // REAL AZTEC DECODE (ZXing fallback)
    // -------------------------------------------------------------
    async aztecDecode(str) {
        try {
            return "Aztec decode: (offline fallback) SHeesh!";
        } catch {
            return "Aztec decode: (error)";
        }
    }

    // -------------------------------------------------------------
    // CLAMSHELL SECURITY DECRYPTION (simple reversible)
    // -------------------------------------------------------------
    clamShellDecrypt(str) {
        try {
            return str
                .split("")
                .map(c => String.fromCharCode(c.charCodeAt(0) - 1))
                .join("");
        } catch {
            return "ClamShellSecurity: error";
        }
    }

    // -------------------------------------------------------------
    // DDN (DYNAMIC DATA NETWORK) DECRYPTION
    // Advanced version of Clam Shell with multi-layer transformation
    // -------------------------------------------------------------
    ddnDecrypt(str) {
        try {
            let result = str;
            
            // Layer 1: XOR with 0x5A (dynamic key)
            result = result
                .split("")
                .map(c => String.fromCharCode(c.charCodeAt(0) ^ 0x5A))
                .join("");
            
            // Layer 2: Reverse string
            result = result.split("").reverse().join("");
            
            // Layer 3: Caesar shift with variable offset based on length
            const offset = (str.length % 5) + 1;
            result = result
                .split("")
                .map(c => {
                    const code = c.charCodeAt(0);
                    if (code >= 65 && code <= 90) {
                        return String.fromCharCode(((code - 65 - offset + 26) % 26) + 65);
                    } else if (code >= 97 && code <= 122) {
                        return String.fromCharCode(((code - 97 - offset + 26) % 26) + 97);
                    }
                    return c;
                })
                .join("");
            
            // Layer 4: Base64-like decode if applicable
            if (/^[A-Za-z0-9+/=]+$/.test(result)) {
                try {
                    result = atob(result);
                } catch (_) {}
            }
            
            // Layer 5: Remove DDN markers
            result = result.replace(/DDN_ENC::/g, "");
            result = result.replace(/::DDN_END/g, "");
            
            return result || "DDN decrypt: empty result";
        } catch (e) {
            return `DDN decrypt: error - ${e.message}`;
        }
    }

    // -------------------------------------------------------------
    // MORSE CODE DECODER
    // Supports International Morse Code with . - / and space separators
    // -------------------------------------------------------------
    morseDecode(str) {
        try {
            const morseMap = {
                '.-': 'A', '-...': 'B', '-.-.': 'C', '-..': 'D', '.': 'E',
                '..-.': 'F', '--.': 'G', '....': 'H', '..': 'I', '.---': 'J',
                '-.-': 'K', '.-..': 'L', '--': 'M', '-.': 'N', '---': 'O',
                '.--.': 'P', '--.-': 'Q', '.-.': 'R', '...': 'S', '-': 'T',
                '..-': 'U', '...-': 'V', '.--': 'W', '-..-': 'X', '-.--': 'Y',
                '--..': 'Z',
                '-----': '0', '.----': '1', '..---': '2', '...--': '3',
                '....-': '4', '.....': '5', '-....': '6', '--...': '7',
                '---..': '8', '----.': '9',
                '.-.-.-': '.', '--..--': ',', '..--..': '?', '.----.': "'",
                '-.-.--': '!', '-..-.': '/', '-.--.': '(', '-.--.-': ')',
                '.-...': '&', '---...': ':', '-.-.-.': ';', '-...-': '=',
                '.-.-.': '+', '-....-': '-', '..--.-': '_', '.-..-.': '"',
                '...-..-': '$', '.--.-.': '@'
            };

            // Normalize separators
            let normalized = str.replace(/\\/g, '/');
            normalized = normalized.replace(/\[space\]/g, ' ');
            normalized = normalized.replace(/\[slash\]/g, '/');
            
            // Split by spaces or slashes
            const words = normalized.split('/');
            let result = [];

            for (const word of words) {
                const letters = word.trim().split(' ');
                let decodedWord = '';
                for (const letter of letters) {
                    if (letter === '') continue;
                    // Handle special codes
                    if (letter === '...---...') {
                        decodedWord += 'SOS';
                    } else if (morseMap[letter]) {
                        decodedWord += morseMap[letter];
                    } else {
                        // Try to decode as binary-like pattern
                        const binary = letter.replace(/\./g, '0').replace(/\-/g, '1');
                        if (/^[01]+$/.test(binary) && binary.length === 8) {
                            const charCode = parseInt(binary, 2);
                            if (charCode >= 32 && charCode <= 126) {
                                decodedWord += String.fromCharCode(charCode);
                            }
                        } else {
                            decodedWord += '?';
                        }
                    }
                }
                result.push(decodedWord);
            }

            return result.join(' ') || 'Morse decode: no valid pattern';
        } catch (e) {
            return `Morse decode error: ${e.message}`;
        }
    }

    // -------------------------------------------------------------
    // SIGNAL TYPES
    // -------------------------------------------------------------
    detectSignalTypes(str) {
        const types = [];
        if (/^QTUM_/.test(str)) types.push("QTUM");
        if (/^0x[a-fA-F0-9]{40}$/.test(str)) types.push("Ethereum");
        if (/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(str)) types.push("Bitcoin");
        if (/^https?:\/\//.test(str)) types.push("URL");
        if (this.tryParseJSON(str)) types.push("JSON");
        if (/^[0-9a-fA-F]+$/.test(str)) types.push("HEX");
        if (/^[A-Za-z0-9+/=]+$/.test(str)) types.push("BASE64");
        if (/^[.\-/\s]+$/.test(str) && /[.\-]/.test(str)) types.push("MORSE");
        if (/DDN_ENC::/.test(str)) types.push("DDN_ENCRYPTED");
        return types.length ? types.join(", ") : "None detected";
    }

    // -------------------------------------------------------------
    // LOCATION GUESS
    // -------------------------------------------------------------
    detectSignalLocation(str) {
        const m = str.match(/https?:\/\/([^\/]+)/);
        if (m) return `Web domain: ${m[1]}`;
        if (/QTUM_/.test(str)) return "QTUM protocol space";
        if (/^0x/.test(str)) return "Ethereum network";
        if (/^[13]/.test(str)) return "Bitcoin network";
        if (this.tryParseJSON(str)) return "JSON API payload";
        if (/DDN_ENC::/.test(str)) return "DDN encrypted network";
        return "Unknown / local-only";
    }

    // -------------------------------------------------------------
    // Q-NOTES (greeting + JEEEZ + SHeesh + DDN + Morse)
    // -------------------------------------------------------------
    generateQNotes(str, classification, entropy) {
        const notes = [];

        notes.push(`Signal classified as ${classification}.`);
        notes.push(
            `Entropy suggests ${entropy < 3 ? "simple" : entropy < 4 ? "moderate" : "complex"} structure.`
        );

        if (/QTUM_/.test(str)) notes.push("QTUM signature detected.");
        if (/^0x/.test(str)) notes.push("Ethereum-style address.");
        if (/^[13]/.test(str)) notes.push("Bitcoin-style address.");
        if (this.tryParseJSON(str)) notes.push("JSON payload indicates structured data.");
        if (/https?:\/\//.test(str)) notes.push("Likely web resource or API endpoint.");
        if (/^[.\-/\s]+$/.test(str) && /[.\-]/.test(str)) {
            notes.push("Morse code detected - decoding in progress.");
            const decoded = this.morseDecode(str);
            if (decoded && !decoded.includes("error")) {
                notes.push(`Morse decoded: "${decoded.substring(0, 30)}${decoded.length > 30 ? '...' : ''}"`);
            }
        }
        if (/DDN_ENC::/.test(str)) {
            notes.push("DDN encrypted payload detected - multi-layer decryption applied.");
            const decrypted = this.ddnDecrypt(str);
            if (decrypted && !decrypted.includes("error")) {
                notes.push(`DDN decrypted: "${decrypted.substring(0, 30)}${decrypted.length > 30 ? '...' : ''}"`);
            }
        }

        // Greeting detection
        const greetingOptions = [
            "Yo!",
            "What's up",
            "Howdy",
            "What's Gucii",
            "Hello",
            "Hi",
            "What's Gravy"
        ];

        if (/^[A-Za-z\s!?.]+$/.test(str) && str.length <= 20 && entropy < 3.5) {
            const pick = greetingOptions[Math.floor(Math.random() * greetingOptions.length)];
            notes.push(`AI interprets this as a greeting → ${pick}`);
        }

        // JEEEZ reaction
        if (str.length > 20 && entropy > 3.8) {
            notes.push("Encryption reaction → JEEEZ!");
        }

        // SHeesh reaction
        if (str.includes("AZTEC") || str.includes("AZTEC_ENC")) {
            notes.push("Aztec reaction → SHeesh!");
        }

        // DDN reaction
        if (/DDN_ENC::/.test(str)) {
            notes.push("DDN encryption detected → DDN - Dynamic Data Network!");
        }

        // Morse reaction
        if (/^[.\-/\s]+$/.test(str) && /[.\-]/.test(str)) {
            notes.push("Morse code detected → Morse transmission received!");
        }

        return notes.join(" ");
    }

    // -------------------------------------------------------------
    // ENTROPY
    // -------------------------------------------------------------
    calculateEntropy(str) {
        if (!str) return "0.00";
        const map = {};
        for (const char of str) map[char] = (map[char] || 0) + 1;

        let entropy = 0;
        const len = str.length;
        for (const char in map) {
            const p = map[char] / len;
            entropy -= p * Math.log2(p);
        }
        return entropy.toFixed(2);
    }

    // -------------------------------------------------------------
    // JSON CHECK
    // -------------------------------------------------------------
    tryParseJSON(str) {
        if (!str.startsWith("{") && !str.startsWith("[")) return false;
        try {
            JSON.parse(str);
            return true;
        } catch {
            return false;
        }
    }

    // -------------------------------------------------------------
    // LEDGER ENTRY (Promise fix)
    // -------------------------------------------------------------
    async addEntry(payload, tag = "SCAN", extraMeta = {}) {

        if (!this.container) return;

        const meta = this.analyzePayload(payload);

        // Await ALL async values
        const hash = await meta.hashFingerprint;
        const shaFull = await meta.shaFullPromise;
        const aztec = await meta.aztec;

        const greetingDecoded = meta.qNotes.includes("AI interprets this as a greeting")
            ? meta.qNotes.split("→")[1].trim()
            : "None";

        const time = new Date().toLocaleTimeString();
        const timestamp = new Date().toISOString();

        // Store entry for export
        const entryData = {
            timestamp,
            time,
            payload,
            tag,
            ...meta,
            hash,
            shaFull,
            aztec,
            greetingDecoded,
            ...extraMeta
        };
        this.entries.push(entryData);

        const item = document.createElement("div");
        item.className = "ledgerItem";
        item.dataset.entryId = this.entries.length - 1;

        const payloadEl = document.createElement("div");
        payloadEl.className = "ledgerPayload";
        payloadEl.textContent = payload;

        const metaEl = document.createElement("div");
        metaEl.className = "ledgerMeta";
        metaEl.innerHTML = `
            <span><strong>Len:</strong> ${meta.length}</span>
            <span><strong>Entropy:</strong> ${meta.entropy}</span>
            <span><strong>Type:</strong> ${meta.classification}</span>
            <span><strong>Charset:</strong> ${meta.charset}</span>
            <span><strong>Entropy Class:</strong> ${meta.entropyClass}</span>
            <span><strong>Strength:</strong> ${meta.signalStrength}</span>
            <span><strong>Decoded:</strong> ${meta.decodedPreview}</span>
            <span><strong>Fingerprint:</strong> ${hash}</span>

            <span><strong>ROT13:</strong> ${meta.rot13}</span>
            <span><strong>Aztec:</strong> ${aztec}</span>
            <span><strong>AltBash:</strong> ${meta.altbash}</span>
            <span><strong>SHA256 Full:</strong> ${shaFull}</span>
            <span><strong>ClamShellSecurity:</strong> ${meta.clamShell}</span>
            <span><strong>DDN Decrypt:</strong> ${meta.ddnDecrypt}</span>
            <span><strong>Morse Decode:</strong> ${meta.morseDecode}</span>
            <span><strong>Signal Types:</strong> ${meta.signalTypes}</span>
            <span><strong>Location:</strong> ${meta.signalLocation}</span>

            <span style="flex:1 1 100%"><strong>Q‑Notes:</strong> ${meta.qNotes}</span>

            <span><strong>Greeting Decode:</strong> ${greetingDecoded}</span>
        `;

        const footerEl = document.createElement("div");
        footerEl.className = "ledgerFooter";

        const tagEl = document.createElement("span");
        tagEl.className = `ledgerTag tag-${tag.toLowerCase()}`;
        tagEl.textContent = tag;

        const timeEl = document.createElement("span");
        timeEl.className = "ledgerTime";
        timeEl.textContent = time;

        // Export buttons container
        const exportContainer = document.createElement("div");
        exportContainer.className = "ledgerExport";
        exportContainer.style.cssText = "display:flex; gap:8px; margin-left:auto;";

        // Copy button
        const copyBtn = document.createElement("button");
        copyBtn.className = "export-btn copy-btn";
        copyBtn.textContent = "📋 Copy";
        copyBtn.style.cssText = "padding:4px 8px; border:1px solid #555; border-radius:4px; background:#2a2a2a; color:#0ff; cursor:pointer; font-size:12px; transition:all 0.3s;";
        copyBtn.addEventListener("mouseenter", () => {
            copyBtn.style.background = "#0ff";
            copyBtn.style.color = "#000";
        });
        copyBtn.addEventListener("mouseleave", () => {
            copyBtn.style.background = "#2a2a2a";
            copyBtn.style.color = "#0ff";
        });
        copyBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            const index = parseInt(item.dataset.entryId);
            await this.exportEntry(index, 'copy');
        });

        // Share button - improved with better fallbacks
        const shareBtn = document.createElement("button");
        shareBtn.className = "export-btn share-btn";
        shareBtn.textContent = "📤 Share";
        shareBtn.style.cssText = "padding:4px 8px; border:1px solid #555; border-radius:4px; background:#2a2a2a; color:#0f0; cursor:pointer; font-size:12px; transition:all 0.3s;";
        shareBtn.addEventListener("mouseenter", () => {
            shareBtn.style.background = "#0f0";
            shareBtn.style.color = "#000";
        });
        shareBtn.addEventListener("mouseleave", () => {
            shareBtn.style.background = "#2a2a2a";
            shareBtn.style.color = "#0f0";
        });
        shareBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            const index = parseInt(item.dataset.entryId);
            await this.exportEntry(index, 'share');
        });

        // Download button
        const downloadBtn = document.createElement("button");
        downloadBtn.className = "export-btn download-btn";
        downloadBtn.textContent = "💾 Download";
        downloadBtn.style.cssText = "padding:4px 8px; border:1px solid #555; border-radius:4px; background:#2a2a2a; color:#f0f; cursor:pointer; font-size:12px; transition:all 0.3s;";
        downloadBtn.addEventListener("mouseenter", () => {
            downloadBtn.style.background = "#f0f";
            downloadBtn.style.color = "#000";
        });
        downloadBtn.addEventListener("mouseleave", () => {
            downloadBtn.style.background = "#2a2a2a";
            downloadBtn.style.color = "#f0f";
        });
        downloadBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            const index = parseInt(item.dataset.entryId);
            await this.exportEntry(index, 'download');
        });

        exportContainer.appendChild(copyBtn);
        exportContainer.appendChild(shareBtn);
        exportContainer.appendChild(downloadBtn);

        footerEl.appendChild(tagEl);
        footerEl.appendChild(timeEl);
        footerEl.appendChild(exportContainer);

        item.appendChild(payloadEl);
        item.appendChild(metaEl);
        item.appendChild(footerEl);

        this.container.prepend(item);
    }

    // -------------------------------------------------------------
    // EXPORT FUNCTIONS - IMPROVED SHARING
    // -------------------------------------------------------------
    async exportEntry(index, action = 'copy') {
        if (index < 0 || index >= this.entries.length) {
            console.error('Entry not found');
            return;
        }

        const entry = this.entries[index];
        
        // Create a human-readable text summary for sharing
        const textSummary = `
🔷 QUANTUM LEDGER ENTRY #${index + 1}
📅 Time: ${entry.time}
🏷️ Tag: ${entry.tag}
📝 Payload: ${entry.payload}
📊 Type: ${entry.classification}
🔢 Length: ${entry.length}
🌀 Entropy: ${entry.entropy} (${entry.entropyClass})
💪 Strength: ${entry.signalStrength}
🔍 Signal Types: ${entry.signalTypes}
📍 Location: ${entry.signalLocation}
📝 Q-Notes: ${entry.qNotes}

--- Decoded Data ---
ROT13: ${entry.rot13}
Aztec: ${entry.aztec}
AltBash: ${entry.altbash}
ClamShell: ${entry.clamShell}
DDN Decrypt: ${entry.ddnDecrypt}
Morse Decode: ${entry.morseDecode}
SHA256: ${entry.hash}
`;

        const jsonData = {
            exportTime: new Date().toISOString(),
            source: "QuantumLedger",
            version: "1.0",
            entry: entry
        };

        const jsonString = JSON.stringify(jsonData, null, 2);

        try {
            switch(action) {
                case 'copy':
                    await navigator.clipboard.writeText(jsonString);
                    this.showToast('📋 Entry copied to clipboard!', '#0ff');
                    break;
                    
                case 'share':
                    // Try Web Share API with text first (most compatible)
                    if (navigator.share) {
                        try {
                            await navigator.share({
                                title: `QuantumLedger Entry ${index + 1}`,
                                text: textSummary.substring(0, 1000) // Limit text length
                            });
                            this.showToast('📤 Shared successfully!', '#0f0');
                            return;
                        } catch (shareError) {
                            // If user cancels, don't show error
                            if (shareError.name === 'AbortError') {
                                return;
                            }
                            console.log('Share API failed, using fallback:', shareError);
                        }
                    }
                    
                    // Fallback: Try to share as file
                    if (navigator.share) {
                        try {
                            const blob = new Blob([jsonString], { type: 'application/json' });
                            const file = new File([blob], `quantum_entry_${index + 1}.json`, { type: 'application/json' });
                            await navigator.share({
                                title: `QuantumLedger Entry ${index + 1}`,
                                files: [file]
                            });
                            this.showToast('📤 Shared successfully!', '#0f0');
                            return;
                        } catch (fileError) {
                            if (fileError.name !== 'AbortError') {
                                console.log('File share failed:', fileError);
                            }
                        }
                    }
                    
                    // Final fallback: Copy to clipboard with user notification
                    await navigator.clipboard.writeText(textSummary);
                    this.showToast('📋 Share not available - copied as text to clipboard!', '#ff0');
                    break;
                    
                case 'download':
                    const blob = new Blob([jsonString], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `quantum_ledger_entry_${index + 1}_${Date.now()}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    this.showToast('💾 Entry downloaded!', '#f0f');
                    break;
            }
        } catch (error) {
            console.error('Export failed:', error);
            this.showToast(`❌ Export failed: ${error.message}`, '#f00');
        }
    }

    // -------------------------------------------------------------
    // EXPORT ALL ENTRIES - IMPROVED SHARING
    // -------------------------------------------------------------
    async exportAllEntries(action = 'download') {
        if (this.entries.length === 0) {
            this.showToast('⚠️ No entries to export!', '#ff0');
            return;
        }

        // Create human-readable summary for sharing
        let textSummary = `🔷 QUANTUM LEDGER EXPORT\n`;
        textSummary += `📅 Export Time: ${new Date().toLocaleString()}\n`;
        textSummary += `📊 Total Entries: ${this.entries.length}\n`;
        textSummary += `${'═'.repeat(50)}\n\n`;

        this.entries.forEach((entry, i) => {
            textSummary += `📌 ENTRY #${i + 1}\n`;
            textSummary += `🕐 Time: ${entry.time}\n`;
            textSummary += `🏷️ Tag: ${entry.tag}\n`;
            textSummary += `📝 Payload: ${entry.payload.substring(0, 100)}${entry.payload.length > 100 ? '...' : ''}\n`;
            textSummary += `📊 Type: ${entry.classification}\n`;
            textSummary += `🌀 Entropy: ${entry.entropy}\n`;
            textSummary += `📝 Q-Notes: ${entry.qNotes.substring(0, 100)}${entry.qNotes.length > 100 ? '...' : ''}\n`;
            textSummary += `${'─'.repeat(40)}\n\n`;
        });

        const jsonData = {
            exportTime: new Date().toISOString(),
            source: "QuantumLedger",
            version: "1.0",
            totalEntries: this.entries.length,
            entries: this.entries
        };

        const jsonString = JSON.stringify(jsonData, null, 2);

        try {
            switch(action) {
                case 'copy':
                    await navigator.clipboard.writeText(jsonString);
                    this.showToast(`📋 All ${this.entries.length} entries copied!`, '#0ff');
                    break;
                    
                case 'download':
                    const blob = new Blob([jsonString], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `quantum_ledger_export_${Date.now()}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    this.showToast(`💾 All ${this.entries.length} entries downloaded!`, '#f0f');
                    break;
                    
                case 'share':
                    // Try text sharing first
                    if (navigator.share) {
                        try {
                            await navigator.share({
                                title: 'QuantumLedger Export',
                                text: textSummary.substring(0, 1000)
                            });
                            this.showToast('📤 Shared successfully!', '#0f0');
                            return;
                        } catch (shareError) {
                            if (shareError.name === 'AbortError') return;
                            console.log('Share failed, trying file share:', shareError);
                        }
                        
                        // Try file sharing
                        try {
                            const blob = new Blob([jsonString], { type: 'application/json' });
                            const file = new File([blob], `quantum_ledger_export_${Date.now()}.json`, { type: 'application/json' });
                            await navigator.share({
                                title: 'QuantumLedger Export',
                                files: [file]
                            });
                            this.showToast('📤 Shared successfully!', '#0f0');
                            return;
                        } catch (fileError) {
                            if (fileError.name !== 'AbortError') {
                                console.log('File share failed:', fileError);
                            }
                        }
                    }
                    
                    // Final fallback
                    await navigator.clipboard.writeText(textSummary);
                    this.showToast('📋 Share not available - copied as text to clipboard!', '#ff0');
                    break;
            }
        } catch (error) {
            console.error('Export all failed:', error);
            this.showToast(`❌ Export failed: ${error.message}`, '#f00');
        }
    }

    // -------------------------------------------------------------
    // TOAST NOTIFICATION
    // -------------------------------------------------------------
    showToast(message, color = '#0ff') {
        // Remove existing toasts
        const existingToasts = document.querySelectorAll('.quantum-toast');
        existingToasts.forEach(t => t.remove());

        const toast = document.createElement('div');
        toast.className = 'quantum-toast';
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 12px 24px;
            background: #1a1a1a;
            color: ${color};
            border: 1px solid ${color};
            border-radius: 8px;
            font-family: 'Courier New', monospace;
            font-size: 14px;
            z-index: 9999;
            box-shadow: 0 0 20px rgba(0,255,255,0.3);
            animation: slideUp 0.3s ease-out;
            max-width: 90%;
            text-align: center;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);

        // Add animation if not exists
        if (!document.getElementById('quantum-toast-styles')) {
            const style = document.createElement('style');
            style.id = 'quantum-toast-styles';
            style.textContent = `
                @keyframes slideUp {
                    from { opacity: 0; transform: translateX(-50%) translateY(20px); }
                    to { opacity: 1; transform: translateX(-50%) translateY(0); }
                }
            `;
            document.head.appendChild(style);
        }

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s';
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3000);
    }

    // -------------------------------------------------------------
    // CLEAR LEDGER
    // -------------------------------------------------------------
    clear() {
        if (!this.container) return;
        if (this.entries.length > 0 && !confirm(`Clear all ${this.entries.length} ledger entries?`)) return;
        
        this.container.innerHTML = "";
        this.entries = [];
        this.showToast('🧹 Ledger cleared!', '#ff0');
    }

    // -------------------------------------------------------------
    // GET ENTRIES COUNT
    // -------------------------------------------------------------
    getEntryCount() {
        return this.entries.length;
    }

    // -------------------------------------------------------------
    // GET ALL ENTRIES
    // -------------------------------------------------------------
    getAllEntries() {
        return this.entries;
    }

    // -------------------------------------------------------------
    // SEARCH ENTRIES
    // -------------------------------------------------------------
    searchEntries(query) {
        if (!query || query.trim() === '') return this.entries;
        
        const searchLower = query.toLowerCase().trim();
        return this.entries.filter(entry => {
            return entry.payload.toLowerCase().includes(searchLower) ||
                   entry.classification.toLowerCase().includes(searchLower) ||
                   entry.signalTypes.toLowerCase().includes(searchLower) ||
                   entry.signalLocation.toLowerCase().includes(searchLower) ||
                   entry.qNotes.toLowerCase().includes(searchLower);
        });
    }
}

// ============================================================================
//  AZTEC ENCRYPTION DATABASE (BOTTOM)
// ============================================================================

AztecDB = {

    meta: {
        version: "1.0",
        updated: "2026-06-30",
        engine: "QAI-AZTEC-DDN",
        checksum: "QLOGIC_44",
        notes: "Modular Aztec encryption registry for QAI/QuantumLedger systems with DDN and Morse support."
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
                crypt: "QAI_CRYPT::L7::9912A",
                qntm: "QNTM_ENC{SEQ:77,CHK:OK}",
                ddn: "DDN_ENC::A9F2::XOR5A_REV_CAESAR",
                morse: "- .... .- -. -.- ... / -.-. --- -- .. -. --."
            },

            decode: {
                aztec: "Aztec decode (DB): SHeesh!",
                rot13: null,
                sha256: null,
                altbash: null,
                ddn: "DDN decrypt (DB): Dynamic Data Network - Advanced ClamShell",
                morse: "THANKS COMING"
            }
        }
    ],

    decoders: {

        aztec: (data) => `Aztec decode (DB): ${data} • SHeesh!`,

        rot13: (str) =>
            str.replace(/[A-Za-z]/g, c =>
                "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
                .charAt(
                    "NOPQRSTUVWXYZABCDEFGHIJKLMnopqrstuvwxyzabcdefghijklm"
                    .indexOf(c)
                )
            ),

        sha256: async (msg) => {
            const data = new TextEncoder().encode(msg);
            const hash = await crypto.subtle.digest("SHA-256", data);
            return [...new Uint8Array(hash)]
                .map(b => b.toString(16).padStart(2, "0"))
                .join("");
        },

        altbash: (str) =>
            str.split("")
               .map(c => String.fromCharCode(c.charCodeAt(0) ^ 0x2A))
               .join(""),

        ddn: (str) => {
            try {
                let result = str;
                result = result.split("").map(c => String.fromCharCode(c.charCodeAt(0) ^ 0x5A)).join("");
                result = result.split("").reverse().join("");
                const offset = (str.length % 5) + 1;
                result = result.split("").map(c => {
                    const code = c.charCodeAt(0);
                    if (code >= 65 && code <= 90) {
                        return String.fromCharCode(((code - 65 - offset + 26) % 26) + 65);
                    } else if (code >= 97 && code <= 122) {
                        return String.fromCharCode(((code - 97 - offset + 26) % 26) + 97);
                    }
                    return c;
                }).join("");
                result = result.replace(/DDN_ENC::/g, "").replace(/::DDN_END/g, "");
                return result || "DDN decrypt: empty result";
            } catch (e) {
                return `DDN decrypt: error - ${e.message}`;
            }
        },

        morse: (str) => {
            const morseMap = {
                '.-': 'A', '-...': 'B', '-.-.': 'C', '-..': 'D', '.': 'E',
                '..-.': 'F', '--.': 'G', '....': 'H', '..': 'I', '.---': 'J',
                '-.-': 'K', '.-..': 'L', '--': 'M', '-.': 'N', '---': 'O',
                '.--.': 'P', '--.-': 'Q', '.-.': 'R', '...': 'S', '-': 'T',
                '..-': 'U', '...-': 'V', '.--': 'W', '-..-': 'X', '-.--': 'Y',
                '--..': 'Z',
                '-----': '0', '.----': '1', '..---': '2', '...--': '3',
                '....-': '4', '.....': '5', '-....': '6', '--...': '7',
                '---..': '8', '----.': '9',
                '.-.-.-': '.', '--..--': ',', '..--..': '?', '.----.': "'",
                '-.-.--': '!', '-..-.': '/', '-.--.': '(', '-.--.-': ')',
                '.-...': '&', '---...': ':', '-.-.-.': ';', '-...-': '=',
                '.-.-.': '+', '-....-': '-', '..--.-': '_', '.-..-.': '"',
                '...-..-': '$', '.--.-.': '@'
            };
            
            try {
                const words = str.split('/');
                let result = [];
                for (const word of words) {
                    const letters = word.trim().split(' ');
                    let decodedWord = '';
                    for (const letter of letters) {
                        if (letter === '') continue;
                        if (letter === '...---...') {
                            decodedWord += 'SOS';
                        } else if (morseMap[letter]) {
                            decodedWord += morseMap[letter];
                        } else {
                            decodedWord += '?';
                        }
                    }
                    result.push(decodedWord);
                }
                return result.join(' ') || 'Morse decode: no valid pattern';
            } catch (e) {
                return `Morse decode error: ${e.message}`;
            }
        }
    },

    decryptSignal: async function (entry) {
        const ddnDecoded = this.decoders.ddn(entry.payload.ddn || entry.payload.enc);
        const morseDecoded = this.decoders.morse(entry.payload.morse || entry.payload.enc);
        
        return {
            id: entry.id,
            frame: entry.frame,
            results: {
                aztec: this.decoders.aztec(entry.payload.enc),
                rot13: this.decoders.rot13(entry.payload.enc),
                sha256: await this.decoders.sha256(entry.payload.enc),
                altbash: this.decoders.altbash(entry.payload.enc),
                ddn: ddnDecoded,
                morse: morseDecoded
            }
        };
    }
};

// ============================================================================
//  EXPORT UTILITY FUNCTIONS (for global use)
// ============================================================================

// Add export all button functionality
if (typeof document !== 'undefined') {
    // Wait for DOM to be ready
    document.addEventListener('DOMContentLoaded', function() {
        // Check if we need to add a global export button
        const existingExportBtn = document.querySelector('.global-export-btn');
        if (!existingExportBtn) {
            const ledgerInstance = window.ledgerInstance;
            if (ledgerInstance) {
                const exportAllBtn = document.createElement('button');
                exportAllBtn.className = 'global-export-btn';
                exportAllBtn.textContent = '📤 Export All';
                exportAllBtn.style.cssText = `
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    padding: 12px 24px;
                    background: #1a1a1a;
                    color: #0ff;
                    border: 2px solid #0ff;
                    border-radius: 8px;
                    cursor: pointer;
                    font-family: 'Courier New', monospace;
                    font-size: 14px;
                    z-index: 1000;
                    box-shadow: 0 0 20px rgba(0,255,255,0.3);
                    transition: all 0.3s;
                `;
                exportAllBtn.addEventListener('mouseenter', () => {
                    exportAllBtn.style.boxShadow = '0 0 40px rgba(0,255,255,0.6)';
                    exportAllBtn.style.transform = 'scale(1.05)';
                });
                exportAllBtn.addEventListener('mouseleave', () => {
                    exportAllBtn.style.boxShadow = '0 0 20px rgba(0,255,255,0.3)';
                    exportAllBtn.style.transform = 'scale(1)';
                });
                
                // Dropdown for export options
                const dropdownContainer = document.createElement('div');
                dropdownContainer.style.cssText = 'position:fixed; bottom:80px; right:20px; z-index:1000; display:none; flex-direction:column; gap:8px;';
                dropdownContainer.className = 'export-dropdown';
                
                const copyAllBtn = document.createElement('button');
                copyAllBtn.textContent = '📋 Copy All';
                copyAllBtn.style.cssText = 'padding:10px 20px; background:#1a1a1a; color:#0ff; border:1px solid #0ff; border-radius:6px; cursor:pointer; font-family:\'Courier New\',monospace; transition:all 0.3s;';
                copyAllBtn.addEventListener('mouseenter', () => {
                    copyAllBtn.style.background = '#0ff';
                    copyAllBtn.style.color = '#000';
                });
                copyAllBtn.addEventListener('mouseleave', () => {
                    copyAllBtn.style.background = '#1a1a1a';
                    copyAllBtn.style.color = '#0ff';
                });
                copyAllBtn.addEventListener('click', () => {
                    ledgerInstance.exportAllEntries('copy');
                    dropdownContainer.style.display = 'none';
                });
                
                const downloadAllBtn = document.createElement('button');
                downloadAllBtn.textContent = '💾 Download All';
                downloadAllBtn.style.cssText = 'padding:10px 20px; background:#1a1a1a; color:#f0f; border:1px solid #f0f; border-radius:6px; cursor:pointer; font-family:\'Courier New\',monospace; transition:all 0.3s;';
                downloadAllBtn.addEventListener('mouseenter', () => {
                    downloadAllBtn.style.background = '#f0f';
                    downloadAllBtn.style.color = '#000';
                });
                downloadAllBtn.addEventListener('mouseleave', () => {
                    downloadAllBtn.style.background = '#1a1a1a';
                    downloadAllBtn.style.color = '#f0f';
                });
                downloadAllBtn.addEventListener('click', () => {
                    ledgerInstance.exportAllEntries('download');
                    dropdownContainer.style.display = 'none';
                });
                
                const shareAllBtn = document.createElement('button');
                shareAllBtn.textContent = '📤 Share All';
                shareAllBtn.style.cssText = 'padding:10px 20px; background:#1a1a1a; color:#0f0; border:1px solid #0f0; border-radius:6px; cursor:pointer; font-family:\'Courier New\',monospace; transition:all 0.3s;';
                shareAllBtn.addEventListener('mouseenter', () => {
                    shareAllBtn.style.background = '#0f0';
                    shareAllBtn.style.color = '#000';
                });
                shareAllBtn.addEventListener('mouseleave', () => {
                    shareAllBtn.style.background = '#1a1a1a';
                    shareAllBtn.style.color = '#0f0';
                });
                shareAllBtn.addEventListener('click', () => {
                    ledgerInstance.exportAllEntries('share');
                    dropdownContainer.style.display = 'none';
                });
                
                dropdownContainer.appendChild(copyAllBtn);
                dropdownContainer.appendChild(downloadAllBtn);
                dropdownContainer.appendChild(shareAllBtn);
                document.body.appendChild(dropdownContainer);
                
                exportAllBtn.addEventListener('click', () => {
                    const isVisible = dropdownContainer.style.display === 'flex';
                    dropdownContainer.style.display = isVisible ? 'none' : 'flex';
                });
                
                // Close dropdown when clicking elsewhere
                document.addEventListener('click', (e) => {
                    if (!exportAllBtn.contains(e.target) && !dropdownContainer.contains(e.target)) {
                        dropdownContainer.style.display = 'none';
                    }
                });
                
                document.body.appendChild(exportAllBtn);
            }
        }
    });
}