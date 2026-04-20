// script to add functionality to a webpage
// the script listens for the contextmenu event (whenever a user right-clicks on the page)
// when event is triggred, the default menu is disabled

// Listen for the right-click event
document.addEventListener('contextmenu', async (event) => {
    // Cancel any ongoing speech to prevent overlapping
    window.speechSynthesis.cancel();

    // Prevent the default menu from opening so we can use our tutor instead
    event.preventDefault(); 

    // Find the element exactly under the mouse pointer
    const element = document.elementFromPoint(event.clientX, event.clientY);
    
    if (element) {
        // Extract attributes from the DOM element
        const attributes = {};
        for (const attr of element.attributes) {
            attributes[attr.name] = attr.value;
        }

        const payload = {
            tag: element.tagName.toLowerCase(),
            id: element.id || "no-id",
            text: element.innerText.slice(0, 100).trim() || "Visual element",
            aria_label: element.getAttribute('aria-label') || element.getAttribute('title'),
            alt_text: element.getAttribute('alt')
        };

        // Send the element data to your local FastAPI server
        try {
            const response = await fetch('http://127.0.0.1:8000/explain', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            
            // Trigger the computer's voice to speak the AI's explanation
            const speech = new SpeechSynthesisUtterance(result.reply);
            window.speechSynthesis.speak(speech);
        } catch (error) {
            console.error("The tutor backend is not running!", error);
        }
    }
});
// ============================================================
// Branch: feature/voice-input
// Feature: Hover an element, ask via voice, get a spoken reply
// ============================================================

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

// ─── State ────────────────────────────────────────────────────────────────────

let hoveredEl   = null;
let activeEl    = null;
let isListening = false;
let recognition = null;

// Conversation history — persists for the whole session
let conversationHistory = [];

function clearClasses(el) {
  if (el) el.classList.remove("wt-hovered", "wt-listening", "wt-speaking");
}

// ─── Hover tracking ───────────────────────────────────────────────────────────

document.addEventListener("mouseover", (e) => {
  const el = e.target;
  if (el.id === "wt-toast") return;
  if (hoveredEl && hoveredEl !== el) clearClasses(hoveredEl);
  hoveredEl = el;
  if (!isListening) el.classList.add("wt-hovered");
});

document.addEventListener("mouseout", (e) => {
  if (!isListening && e.target === hoveredEl) clearClasses(hoveredEl);
});

// ─── Text-to-Speech ───────────────────────────────────────────────────────────

async function speak(audioBase64, fallbackText, onDone) {
  if (!audioBase64) {
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(fallbackText);
    utt.rate = 0.9;
    utt.pitch = 1.0;
    utt.volume = 1.0;
    utt.onend = onDone;
    window.speechSynthesis.speak(utt);
    return;
  }

  try {
    const binary = atob(audioBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    // Resume in case browser suspended it
    if (audioCtx.state === "suspended") await audioCtx.resume();

    const audioBuffer = await audioCtx.decodeAudioData(bytes.buffer);
    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioCtx.destination);
    source.onended = onDone;
    source.start();
  } catch (err) {
    console.error("Kokoro audio error →", err);
    // Fall back to browser TTS
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(fallbackText);
    utt.rate = 0.9;
    utt.onend = onDone;
    window.speechSynthesis.speak(utt);
  }
}

// ─── Speech Recognition ───────────────────────────────────────────────────────

function buildRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;

  const rec = new SR();
  rec.lang            = "en-US";
  rec.continuous      = false;
  rec.interimResults  = false;
  rec.maxAlternatives = 1;

  rec.onstart = () => {
    isListening = true;
    activeEl = hoveredEl;
    if (activeEl) {
      clearClasses(activeEl);
      activeEl.classList.add("wt-listening");
    }
    showToast("🎤 Listening… ask your question", 8000);
  };

  rec.onresult = (event) => {
    const transcript = event.results[0][0].transcript.trim();
    showToast(`You asked: "${transcript}"`, 4000);
    askAboutElement(activeEl, transcript);
  };

  rec.onerror = (e) => {
    if (e.error === "no-speech") return;
    console.error("Web Tutor mic error →", e.error);
    showToast("Couldn't hear you — try again", 3000);
    resetState();
  };

  rec.onend = () => {
    isListening = false;
  };

  return rec;
}

// ─── Keyboard shortcut: backtick ─────────────────────────────────────────────

document.addEventListener("keydown", (e) => {
  if (e.key !== "`") return;

  if (isListening) {
    recognition?.stop();
    resetState();
    showToast("Mic closed", 1500);
    return;
  }

  if (!hoveredEl) {
    showToast("Hover over something first, then press the key", 3000);
    return;
  }

  if (!recognition) recognition = buildRecognition();

  if (!recognition) {
    showToast("Your browser doesn't support voice input", 3000);
    return;
  }

  recognition.start();
});

// ─── Send to backend ─────────────────────────────────────────────────────────

async function askAboutElement(el, question) {
  if (!el) return;

  const payload = {
    tag:         el.tagName.toLowerCase(),
    id:          el.id || "no-id",
    text:        (el.innerText || el.value || "").trim().slice(0, 300),
    aria_label:  el.getAttribute("aria-label") || "",
    aria_role:   el.getAttribute("role")        || "",
    voice_query: question,
    history:     conversationHistory,
  };

  showToast("⏳ Thinking…", 10000);

  try {
    const res = await fetch("http://localhost:8000/explain", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });

    const data  = await res.json();
    const reply = data.reply || "I'm not sure about that.";

    // Save exchange to conversation history
    conversationHistory.push({ role: "user",      content: question });
    conversationHistory.push({ role: "assistant", content: reply    });

    if (activeEl) {
      clearClasses(activeEl);
      activeEl.classList.add("wt-speaking");
    }

    showToast("🔊 Speaking…", (reply.split(" ").length / 2.5) * 1000);
    speak(data.audio, reply, resetState);

  } catch (err) {
    console.error("Web Tutor fetch error →", err);
    showToast("❌ Server not reachable — is it running?", 4000);
    speak(null, "I'm sorry, I couldn't reach my brain. Please make sure the server is running.", resetState);
  }
}

// ─── Reset state ─────────────────────────────────────────────────────────────

function resetState() {
  isListening = false;
  clearClasses(activeEl);
  activeEl = null;
  if (hoveredEl) hoveredEl.classList.add("wt-hovered");
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

injectStyles();
console.log("Web Tutor loaded ✅ | Hover anything → press ` → ask a question");
