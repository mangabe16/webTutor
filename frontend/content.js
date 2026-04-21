// webTutor Hybrid Content Script (Hardcoded Mode)
const APP_MODE = "llm"; // Change to "rule-based" to switch logic

let hoveredEl = null;
let activeEl = null;
let isListening = false;
let recognition = null;
let conversationHistory = [];

// ─── Helper: Unified Payload Builder ──────────────────────────────────────────
/**
 * Gathers deep context from the DOM to send to the backend.
 */
function buildPayload(el, question = "") {
    // Logic to find the semantic container for context
    const parent = el.parentElement;
    const container = el.closest('section, article, main, nav, aside, div, ul, ol, form') || parent || el;

    // Helper to clean and slice text safely
    const getTextSnippet = (node) => {
        if (!node) return '';
        const raw = (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim();
        return raw.slice(0, 220);
    };

    // Extract siblings/children context ("Family Members")
    const familyMembers = Array.from(container.children)
        .slice(0, 8)
        .map((child) => ({
            tag: child.tagName.toLowerCase(),
            id: child.id || 'no-id',
            text: getTextSnippet(child) || 'Visual element',
            aria_label: child.getAttribute('aria-label') || child.getAttribute('title') || null,
            alt_text: child.getAttribute('alt') || null
        }));

    return {
        // Basic Element Info
        tag: el.tagName.toLowerCase(),
        id: el.id || "no-id",
        text: getTextSnippet(el) || "Visual element",
        aria_label: el.getAttribute('aria-label') || el.getAttribute('title') || "",
        alt_text: el.getAttribute('alt') || "",
        
        // Website & URL Context
        page_url: window.location.href,
        site_name: document.title || window.location.hostname,
        
        // Deep Structural Context
        parent_tag: parent ? parent.tagName.toLowerCase() : null,
        parent_text: getTextSnippet(parent) || "",
        container_tag: container ? container.tagName.toLowerCase() : null,
        container_text: getTextSnippet(container) || "",
        family_members: familyMembers,

        // App State
        mode: APP_MODE, 
        voice_query: question,
        history: conversationHistory
    };
}

// ─── Right-Click Logic ───────────────────────────────────────────────────────
document.addEventListener('contextmenu', async (event) => {
    // Cancel any ongoing speech to prevent overlapping
    window.speechSynthesis.cancel();
    
    // Prevent the default menu from opening
    event.preventDefault(); 
    const element = document.elementFromPoint(event.clientX, event.clientY);
    
    if (element) {
        showToast(`Requesting ${APP_MODE} explanation...`);
        const payload = buildPayload(element, "Explain this item.");
        await sendToBackend(element, payload);
    }
});

// ─── Voice Logic (Backtick Key) ──────────────────────────────────────────────
document.addEventListener("keydown", (e) => {
    if (e.key !== "`") return;
    if (!hoveredEl) return showToast("Hover over an element first!");
    
    // Cancel speech when starting a new voice command
    window.speechSynthesis.cancel();

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
            conversationHistory.push({ role: "user", content: payload.voice_query || "Right-click request" });
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
async function speak(audioBase64, fallbackText, onDone = () => {}) {
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
      return; 
    } catch (err) {
      console.error("Kokoro audio playback failed:", err);
    }
  }

  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(fallbackText);
  utt.rate = 0.9;
  utt.pitch = 1.0;
  utt.onend = onDone;
  window.speechSynthesis.speak(utt);
}

// Boot
injectStyles();