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
        const parent = element.parentElement;
        const container = element.closest('section, article, main, nav, aside, div, ul, ol, form') || parent || element;

        const getTextSnippet = (node) => {
            if (!node) {
                return '';
            }

            const raw = (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim();
            return raw.slice(0, 220);
        };

        const familyMembers = Array.from(container.children)
            .slice(0, 8)
            .map((child) => ({
                tag: child.tagName.toLowerCase(),
                id: child.id || 'no-id',
                text: getTextSnippet(child) || 'Visual element',
                aria_label: child.getAttribute('aria-label') || child.getAttribute('title') || null,
                alt_text: child.getAttribute('alt') || null
            }));

        const payload = {
            tag: element.tagName.toLowerCase(),
            id: element.id || "no-id",
            text: getTextSnippet(element) || "Visual element",
            page_url: window.location.href,
            site_name: document.title || window.location.hostname,
            parent_tag: parent ? parent.tagName.toLowerCase() : null,
            parent_text: getTextSnippet(parent) || null,
            container_tag: container ? container.tagName.toLowerCase() : null,
            container_text: getTextSnippet(container) || null,
            family_members: familyMembers,
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