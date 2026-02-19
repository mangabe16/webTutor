// script to add functionality to a webpage
// the script listens for the contextmenu event (whenever a user right-clicks on the page)
// when event is triggred, the default menu is disabled
document.addEventListener('contextmenu', async (e) => {
    e.preventDefault();
    const el = document.elementFromPoint(e.clientX, e.clientY);
    
    const payload = {
        tag: el.tagName.toLowerCase(),
        id: el.id || "no-id",
        text: el.innerText.slice(0, 100) || "visual element"
    };

    const response = await fetch('http://127.0.0.1:8000/explain', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    const speech = new SpeechSynthesisUtterance(result.reply);
    window.speechSynthesis.speak(speech);
});