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

    /* ── Chat Panel ── */
    #wt-panel {
      position: fixed;
      top: 0;
      right: 0;
      width: 320px;
      height: 100vh;
      background: #0f172a;
      color: #f1f5f9;
      font-family: system-ui, sans-serif;
      display: flex;
      flex-direction: column;
      z-index: 2147483646;
      box-shadow: -4px 0 24px rgba(0,0,0,0.4);
      transform: translateX(100%);
      transition: transform 0.3s ease;
    }
    #wt-panel.open {
      transform: translateX(0);
    }
    #wt-panel-header {
      padding: 14px 16px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }
    #wt-panel-header .wt-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 15px;
      font-weight: 600;
    }
    #wt-status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #22c55e;
      flex-shrink: 0;
    }
    #wt-status-dot.listening { background: #fbbf24; }
    #wt-status-dot.speaking  { background: #22c55e; }
    #wt-status-dot.thinking  { background: #3b82f6; }
    #wt-close-btn {
      background: none;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      font-size: 18px;
      padding: 4px;
      line-height: 1;
    }
    #wt-close-btn:hover { color: #f1f5f9; }
    #wt-lang-btn {
      background: #1e293b;
      border: 1px solid rgba(255,255,255,0.12);
      color: #f1f5f9;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 6px;
      line-height: 1.4;
      font-family: system-ui, sans-serif;
    }
    #wt-lang-btn:hover { background: #334155; }
    #wt-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    #wt-messages::-webkit-scrollbar { width: 4px; }
    #wt-messages::-webkit-scrollbar-track { background: transparent; }
    #wt-messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
    .wt-msg {
      max-width: 85%;
      padding: 10px 14px;
      border-radius: 16px;
      font-size: 14px;
      line-height: 1.5;
      word-wrap: break-word;
    }
    .wt-msg.user {
      background: #3b82f6;
      color: #fff;
      align-self: flex-end;
      border-bottom-right-radius: 4px;
    }
    .wt-msg.ai {
      background: #1e293b;
      color: #e2e8f0;
      align-self: flex-start;
      border-bottom-left-radius: 4px;
    }
    .wt-msg.status {
      background: transparent;
      color: #64748b;
      font-size: 12px;
      align-self: center;
      padding: 4px 8px;
    }
    #wt-footer {
      padding: 12px 16px;
      border-top: 1px solid rgba(255,255,255,0.08);
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }
    #wt-mic-btn {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: #3b82f6;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background 0.2s;
    }
    #wt-mic-btn:hover { background: #2563eb; }
    #wt-mic-btn.listening { background: #fbbf24; }
    #wt-mic-btn svg { pointer-events: none; }
    #wt-hint {
      font-size: 12px;
      color: #475569;
      line-height: 1.4;
    }

    /* ── Toggle button (always visible) ── */
    #wt-toggle {
      position: fixed;
      top: 50%;
      right: 0;
      transform: translateY(-50%);
      background: #3b82f6;
      color: white;
      border: none;
      cursor: pointer;
      padding: 10px 6px;
      border-radius: 8px 0 0 8px;
      font-size: 18px;
      z-index: 2147483647;
      transition: background 0.2s;
      writing-mode: vertical-rl;
      font-family: system-ui, sans-serif;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.05em;
    }
    #wt-toggle:hover { background: #2563eb; }

    /* ── Toast ── */
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

// ─── Chat Panel ───────────────────────────────────────────────────────────────

let panelEl = null;
let messagesEl = null;
let micBtnEl = null;
let statusDotEl = null;
let panelOpen = true;

function buildPanel() {
  if (document.getElementById("wt-panel")) return;

  // Toggle button
  const toggle = document.createElement("button");
  toggle.id = "wt-toggle";
  toggle.textContent = "WEB TUTOR";
  toggle.onclick = togglePanel;
  document.body.appendChild(toggle);

  // Panel
  panelEl = document.createElement("div");
  panelEl.id = "wt-panel";
  panelEl.innerHTML = `
    <div id="wt-panel-header">
      <div class="wt-title">
        <div id="wt-status-dot"></div>
        <span>Web Tutor</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <button id="wt-lang-btn" title="Toggle language">EN</button>
        <button id="wt-close-btn" title="Close panel">✕</button>
      </div>
    </div>
    <div id="wt-messages">
      <div class="wt-msg status">Hover anything and press the mic to ask a question</div>
    </div>
    <div id="wt-footer">
      <button id="wt-mic-btn" title="Press to speak">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
          <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
      </button>
      <span id="wt-hint">Hover something then tap mic or press <kbd style="background:#1e293b;padding:1px 5px;border-radius:3px;font-size:11px;">&#96;</kbd></span>
    </div>
  `;
  document.body.appendChild(panelEl);

  messagesEl   = document.getElementById("wt-messages");
  micBtnEl     = document.getElementById("wt-mic-btn");
  statusDotEl  = document.getElementById("wt-status-dot");

  document.getElementById("wt-close-btn").onclick = togglePanel;
  document.getElementById("wt-lang-btn").onclick = toggleLanguage;
  micBtnEl.onclick = triggerMic;

  // Open by default
  panelEl.classList.add("open");
}

function togglePanel() {
  panelOpen = !panelOpen;
  panelEl.classList.toggle("open", panelOpen);
}

function updateLangBtn() {
  const btn = document.getElementById("wt-lang-btn");
  if (!btn) return;
  btn.textContent = currentLanguage === "hi" ? "हि" : "EN";
}

function toggleLanguage() {
  if (currentLanguage === "en") {
    currentLanguage = "hi";
    if (recognition) recognition.lang = "hi-IN";
    showToast("Hindi mode on 🇮🇳", 3000);
    addMessage("ai", "ठीक है! अब मैं हिंदी में बात करूँगा।");
  } else {
    currentLanguage = "en";
    if (recognition) recognition.lang = "en-US";
    showToast("English mode on 🇬🇧", 3000);
    addMessage("ai", "OK! I will speak in English now.");
  }
  updateLangBtn();
  saveState();
}

function addMessage(role, text) {
  const div = document.createElement("div");
  div.className = `wt-msg ${role}`;
  div.textContent = text;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function setStatus(state) {
  if (!statusDotEl) return;
  statusDotEl.className = "";
  statusDotEl.id = "wt-status-dot";
  if (state) statusDotEl.classList.add(state);
  if (micBtnEl) micBtnEl.classList.toggle("listening", state === "listening");
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

let conversationHistory = [];
let currentTask     = "";
let currentTaskStep = 0;
let currentLanguage = "en";
let highlightedEl   = null;

function saveState() {
  chrome.storage.session.set({ currentTask, currentTaskStep, conversationHistory, currentLanguage });
}

function clearClasses(el) {
  if (el) el.classList.remove("wt-hovered", "wt-listening", "wt-speaking");
}

function highlightElement(selector) {
  clearHighlight();
  if (!selector) return;
  const candidates = selector.split(",").map(s => s.trim());
  for (const s of candidates) {
    try {
      const el = document.querySelector(s);
      if (el) {
        el.style.outline       = "3px solid orange";
        el.style.outlineOffset = "4px";
        highlightedEl = el;
        console.log(`[WebTutor] Highlight matched: "${s}"`);
        return;
      }
    } catch (_) {
      console.log(`[WebTutor] Highlight selector invalid: "${s}"`);
    }
  }
  console.log(`[WebTutor] Highlight failed — no match for: "${selector}"`);
}

function clearHighlight() {
  if (!highlightedEl) return;
  highlightedEl.style.outline      = "";
  highlightedEl.style.outlineOffset = "";
  highlightedEl = null;
}

// ─── Hover tracking ───────────────────────────────────────────────────────────

document.addEventListener("mouseover", (e) => {
  const el = e.target;
  if (el.id === "wt-toast" || el.closest("#wt-panel") || el.id === "wt-toggle") return;
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
    if (audioCtx.state === "suspended") await audioCtx.resume();

    const audioBuffer = await audioCtx.decodeAudioData(bytes.buffer);
    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioCtx.destination);
    source.onended = onDone;
    source.start();
  } catch (err) {
    console.error("Kokoro audio error →", err);
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
  rec.lang            = currentLanguage === "hi" ? "hi-IN" : "en-US";
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
    setStatus("listening");
    showToast("🎤 Listening…", 8000);
  };

  rec.onresult = (event) => {
    const transcript = event.results[0][0].transcript.trim().toLowerCase();

    if (transcript.includes("hindi") ||
        transcript.includes("hindi mein") ||
        transcript.includes("turn on hindi") ||
        transcript.includes("switch to hindi") ||
        transcript.includes("hindi mode")) {
      currentLanguage = "hi";
      recognition.lang = "hi-IN";
      saveState();
      addMessage("user", transcript);
      addMessage("ai", "ठीक है! अब मैं हिंदी में बात करूँगा।");
      showToast("Hindi mode on 🇮🇳", 3000);
      return;
    }

    if (transcript.includes("english") ||
        transcript.includes("switch to english") ||
        transcript.includes("turn on english") ||
        transcript.includes("english mode")) {
      currentLanguage = "en";
      recognition.lang = "en-US";
      saveState();
      addMessage("user", transcript);
      addMessage("ai", "OK! I will speak in English now.");
      showToast("English mode on 🇬🇧", 3000);
      return;
    }

    addMessage("user", transcript);
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
    setStatus(null);
  };

  return rec;
}

// ─── Trigger mic (from button or keyboard) ───────────────────────────────────

function triggerMic() {
  if (isListening) {
    recognition?.stop();
    resetState();
    return;
  }

  if (!recognition) recognition = buildRecognition();
  if (!recognition) {
    showToast("Your browser doesn't support voice input", 3000);
    return;
  }

  recognition.start();
}

// ─── Keyboard shortcut: backtick ─────────────────────────────────────────────

document.addEventListener("keydown", (e) => {
  if (e.key !== "`") return;
  triggerMic();
});

// ─── Send to backend ─────────────────────────────────────────────────────────

async function askAboutElement(el, question) {
  if (!el && !currentTask) return;

  const payload = {
    tag:         el ? el.tagName.toLowerCase() : "none",
    id:          el ? (el.id || "no-id") : "no-id",
    text:        el ? (el.innerText || el.value || "").trim().slice(0, 300) : "",
    aria_label:  el ? (el.getAttribute("aria-label") || "") : "",
    aria_role:   el ? (el.getAttribute("role")        || "") : "",
    voice_query: question,
    history:     conversationHistory,
    task:        currentTask,
    task_step:   currentTaskStep,
    language:    currentLanguage,
    url:         window.location.hostname,
    parent_text: el ? (el.parentElement?.innerText || "").trim().slice(0, 100) : "",
  };

  clearHighlight();
  setStatus("thinking");
  showToast("⏳ Thinking…", 10000);

  try {
    const res = await fetch("http://localhost:8000/explain", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });

    const data  = await res.json();
    const reply = data.reply || "I'm not sure about that.";

    currentTask     = data.task      || "";
    currentTaskStep = data.task_step ?? 0;
    highlightElement(data.selector || "");

    conversationHistory.push({ role: "user",      content: question });
    conversationHistory.push({ role: "assistant", content: reply    });
    saveState();

    addMessage("ai", reply);

    if (activeEl) {
      clearClasses(activeEl);
      activeEl.classList.add("wt-speaking");
    }

    setStatus("speaking");
    showToast("🔊 Speaking…", (reply.split(" ").length / 2.5) * 1000);
    speak(data.audio, reply, resetState);

  } catch (err) {
    console.error("Web Tutor fetch error →", err);
    showToast("❌ Server not reachable — is it running?", 4000);
    addMessage("status", "Server not reachable — is it running?");
    speak(null, "I'm sorry, I couldn't reach my brain.", resetState);
  }
}

// ─── Reset state ─────────────────────────────────────────────────────────────

function resetState() {
  isListening = false;
  clearClasses(activeEl);
  activeEl = null;
  setStatus(null);
  if (hoveredEl) hoveredEl.classList.add("wt-hovered");
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

injectStyles();
buildPanel();

chrome.storage.session.get(
  ['currentTask', 'currentTaskStep', 'conversationHistory', 'currentLanguage'],
  (result) => {
    currentTask         = result.currentTask         || "";
    currentTaskStep     = result.currentTaskStep     || 0;
    conversationHistory = result.conversationHistory || [];
    currentLanguage     = result.currentLanguage     || "en";
    updateLangBtn();
    if (currentTask) {
      showToast(`Resuming task: ${currentTask}`, 3000);
    }
  }
);

console.log("Web Tutor loaded ✅ | Hover anything → press ` or tap mic → ask a question");