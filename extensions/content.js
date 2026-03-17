// content.js
// Detects what element the user is pointing at
// Sends it to FastAPI and logs the AI explanation

let lastSentElement = null;

document.addEventListener("mouseover", async (event) => {
  const el = event.target;

  // Avoid sending the same element repeatedly
  if (el === lastSentElement) return;
  lastSentElement = el;

  const payload = {
    tag: el.tagName || "",
    id: el.id || "",
    text: (el.innerText || el.value || "").trim().slice(0, 200)
  };

  // Ignore empty elements
  if (!payload.text) return;

  try {
    const response = await fetch("http://localhost:8000/explain", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    console.log(" Web Tutor AI:", data.reply);
  } catch (error) {
    console.error(" Error talking to backend:", error);
  }
});