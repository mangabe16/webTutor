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