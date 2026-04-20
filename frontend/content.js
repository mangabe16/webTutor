// webTutor Hybrid Content Script (Hardcoded Mode)
const APP_MODE = "llm"; // Change to "rule-based" to switch logic

let hoveredEl = null;
let activeEl = null;
let isListening = false;
let recognition = null;
let conversationHistory = [];

// ─── Helper: Unified Payload Builder ──────────────────────────────────────────
function buildPayload(el, question = "") {
    return {
        tag: el.tagName.toLowerCase(),
        id: el.id || "no-id",
        text: (el.innerText || el.value || "").trim().slice(0, 300),
        aria_label: el.getAttribute('aria-label') || el.getAttribute('title') || "",
        alt_text: el.getAttribute('alt') || "",
        site_name: window.location.hostname,
        parent_text: el.parentElement ? el.parentElement.innerText.slice(0, 500).trim() : "",
        mode: APP_MODE, 
        voice_query: question,
        history: conversationHistory
    };
}

// ─── Right-Click Logic ───────────────────────────────────────────────────────
document.addEventListener('contextmenu', async (event) => {
    event.preventDefault(); 
    const element = document.elementFromPoint(event.clientX, event.clientY);
    
    if (element) {
        const payload = buildPayload(element, "Explain this item.");
        await sendToBackend(element, payload);
    }
});

// ─── Voice Logic (Backtick Key) ──────────────────────────────────────────────
document.addEventListener("keydown", (e) => {
    if (e.key !== "`") return;
    if (!hoveredEl) return showToast("Hover over an element first!");
    
    if (!recognition) recognition = buildRecognition();
    recognition.start();
});

function buildRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.onstart = () => {
        isListening = true;
        activeEl = hoveredEl;
        activeEl.classList.add("wt-listening");
        showToast("🎤 Listening...");
    };
    rec.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        const payload = buildPayload(activeEl, transcript);
        sendToBackend(activeEl, payload);
    };
    rec.onend = () => {
        isListening = false;
        if (activeEl) activeEl.classList.remove("wt-listening");
    };
    return rec;
}

// ─── Backend Communication ──────────────────────────────────────────────────
async function sendToBackend(el, payload) {
    try {
        const res = await fetch("http://localhost:8000/explain", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        const data = await res.json();
        
        if (payload.mode === "llm") {
            conversationHistory.push({ role: "user", content: payload.voice_query });
            conversationHistory.push({ role: "assistant", content: data.reply });
        }

        // speak() handles Kokoro audio or browser TTS fallback
        speak(data.audio, data.reply);

    } catch (err) {
        console.error("Fetch Error:", err);
        showToast("❌ Server unreachable. Ensure main.py is running!");
    }
}

// ─── Hover Tracking ─────────────────────────────────────────────────────────
document.addEventListener("mouseover", (e) => {
    if (isListening) return;
    if (hoveredEl) hoveredEl.classList.remove("wt-hovered");
    hoveredEl = e.target;
    hoveredEl.classList.add("wt-hovered");
});

// ─── Styles ───────────────────────────────────────────────────────────────────
/**
 * Injects the necessary CSS for hover effects and toast notifications.
 */
function injectStyles() {
  if (document.getElementById("wt-styles")) return;

  const style = document.createElement("style");
  style.id = "wt-styles";
  style.textContent = `
    .wt-hovered {
      outline: 2px dashed rgba(59, 130, 246, 0.7) !important;
      outline-offset: 3px !important;
      border-radius: 3px !important;
    }
    @keyframes wt-pulse {
      0%, 100% { outline-color: rgba(251, 191, 36, 0.9); outline-offset: 2px; }
      50%       { outline-color: rgba(251, 191, 36, 0.3); outline-offset: 6px; }
    }
    .wt-listening {
      outline: 3px solid rgba(251, 191, 36, 0.9) !important;
      outline-offset: 2px !important;
      border-radius: 3px !important;
      animation: wt-pulse 1s ease-in-out infinite !important;
    }
    .wt-speaking {
      outline: 3px solid rgba(34, 197, 94, 0.85) !important;
      outline-offset: 3px !important;
      border-radius: 3px !important;
    }
    #wt-toast {
      position: fixed;
      bottom: 28px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(15, 23, 42, 0.92);
      color: #f1f5f9;
      font-family: system-ui, sans-serif;
      font-size: 14px;
      padding: 10px 20px;
      border-radius: 999px;
      z-index: 2147483647;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.25s ease;
      white-space: nowrap;
    }
    #wt-toast.visible { opacity: 1; }
  `;
  document.head.appendChild(style);
}

// ─── Toast ────────────────────────────────────────────────────────────────────
let toastEl = null;
let toastTimer = null;

/**
 * Displays a brief message at the bottom of the screen.
 */
function showToast(msg, durationMs = 3000) {
  if (!toastEl) {
    toastEl = document.createElement("div");
    toastEl.id = "wt-toast";
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("visible"), durationMs);
}

// ─── Text-to-Speech ───────────────────────────────────────────────────────────
/**
 * Plays Kokoro-generated audio or falls back to Browser SpeechSynthesis.
 */
async function speak(audioBase64, fallbackText, onDone = () => {}) {
  // 1. Try to play Kokoro audio from backend
  if (audioBase64) {
    try {
      const binary = atob(audioBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") await audioCtx.resume();

      const audioBuffer = await audioCtx.decodeAudioData(bytes.buffer);
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      source.onended = onDone;
      source.start();
      return; // Success
    } catch (err) {
      console.error("Kokoro audio playback failed:", err);
    }
  }

  // 2. Fallback to browser's built-in TTS
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(fallbackText);
  utt.rate = 0.9; // Slightly slower for clarity
  utt.pitch = 1.0;
  utt.onend = onDone;
  window.speechSynthesis.speak(utt);
}

// Call style injection on boot
injectStyles();