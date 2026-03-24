// ============================================================
// Branch: feature/voice-input
// Feature: Hover an element, ask via voice, get a spoken reply
//
// How to use:
//   1. Hover your mouse over anything on a webpage
//   2. Press  Alt + Shift + V  to open the microphone
//   3. Ask "What is this?" or any question
//   4. The AI will explain it and speak the answer aloud
// ============================================================

// ─── Styles ───────────────────────────────────────────────────────────────────

function injectStyles() {
  if (document.getElementById("wt-styles")) return;

  const style = document.createElement("style");
  style.id = "wt-styles";
  style.textContent = `
    /* Blue dashed outline — element is under the mouse */
    .wt-hovered {
      outline: 2px dashed rgba(59, 130, 246, 0.7) !important;
      outline-offset: 3px !important;
      border-radius: 3px !important;
    }

    /* Yellow pulse — mic is open and listening */
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

    /* Green solid — AI is speaking the reply */
    .wt-speaking {
      outline: 3px solid rgba(34, 197, 94, 0.85) !important;
      outline-offset: 3px !important;
      border-radius: 3px !important;
    }

    /* Toast notification */
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

// ─── Element state ─────────────────────────────────────────────────────────────

let hoveredEl = null;   // element currently under the mouse
let activeEl  = null;   // element locked in when mic opened

function clearClasses(el) {
  if (el) el.classList.remove("wt-hovered", "wt-listening", "wt-speaking");
}

// ─── Hover tracking ───────────────────────────────────────────────────────────

document.addEventListener("mouseover", (e) => {
  const el = e.target;
  if (el.id === "wt-toast") return;              // ignore our own toast
  if (hoveredEl && hoveredEl !== el) clearClasses(hoveredEl);
  hoveredEl = el;
  if (!isListening) el.classList.add("wt-hovered");
});

document.addEventListener("mouseout", (e) => {
  if (!isListening && e.target === hoveredEl) clearClasses(hoveredEl);
});

// ─── Text-to-Speech ───────────────────────────────────────────────────────────

function speak(text, onDone) {
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.rate   = 0.9;    // slightly slower — easier for seniors
  utt.pitch  = 1.0;
  utt.volume = 1.0;
  if (onDone) utt.onend = onDone;
  window.speechSynthesis.speak(utt);
}

// ─── Speech Recognition ───────────────────────────────────────────────────────

let isListening = false;
let recognition  = null;

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
    activeEl = hoveredEl;           // lock the element at mic-open time

    if (activeEl) {
      clearClasses(activeEl);
      activeEl.classList.add("wt-listening");   // yellow pulse
    }

    showToast("🎤 Listening… ask your question", 8000);
    console.log("Web Tutor 🎤 Mic open — locked on:", activeEl?.tagName);
  };

  rec.onresult = (event) => {
    const transcript = event.results[0][0].transcript.trim();
    console.log(`Web Tutor heard → "${transcript}"`);
    showToast(`You asked: "${transcript}"`, 4000);
    askAboutElement(activeEl, transcript);
  };

  rec.onerror = (e) => {
    console.error("Web Tutor mic error →", e.error);
    showToast(" Couldn't hear you — try Alt+Shift+V again", 3000);
    resetState();
  };

  rec.onend = () => {
    isListening = false;
    console.log("Web Tutor 🎤 Mic closed");
  };

  return rec;
}

// ─── Keyboard shortcut:  Alt + Shift + V  ────────────────────────────────────

document.addEventListener("keydown", (e) => {
  if (e.key !== "`") return;

  if (isListening) {
    recognition?.stop();
    resetState();
    showToast("Mic closed", 1500);
    return;
  }

  if (!hoveredEl) {
    showToast("Hover over something first, then press Alt+Shift+V", 3000);
    return;
  }

  if (!recognition) recognition = buildRecognition();

  if (!recognition) {
    showToast(" Your browser doesn't support voice input", 3000);
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
  };

  showToast("⏳ Thinking…", 10000);

  try {
    const res  = await fetch("http://localhost:8000/explain", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });

    const data  = await res.json();
    const reply = data.reply || "I'm not sure about that.";

    console.log("Web Tutor 🤖", reply);

    // Switch to green "speaking" outline while AI talks
    if (activeEl) {
      clearClasses(activeEl);
      activeEl.classList.add("wt-speaking");
    }

    showToast("🔊 Speaking…", (reply.split(" ").length / 2.5) * 1000);
    speak(reply, resetState);   // resetState cleans up when speech ends

  } catch (err) {
    console.error("Web Tutor fetch error →", err);
    showToast("❌ Server not reachable — is it running?", 4000);
    speak("I'm sorry, I couldn't reach my brain. Please make sure the server is running.");
    resetState();
  }
}

// ─── Clean up all state ───────────────────────────────────────────────────────

function resetState() {
  isListening = false;
  clearClasses(activeEl);
  activeEl = null;
  // Restore hovered highlight if mouse is still over something
  if (hoveredEl) hoveredEl.classList.add("wt-hovered");
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

injectStyles();
console.log("Web Tutor loaded ✅ | Hover anything → Alt+Shift+V → ask a question");
