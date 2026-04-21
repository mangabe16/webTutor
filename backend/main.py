"""Web Tutor FastAPI backend — explains webpage elements to senior citizens."""

import re
import io
import base64
import time
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from ollama import AsyncClient

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

print("[WebTutor] Loading Kokoro voice model...")
kokoro = Kokoro("kokoro-v1.0.onnx", "voices-v1.0.bin")
print("[WebTutor] Kokoro ready!")

class Message(BaseModel):
    role: str
    content: str

class ElementInfo(BaseModel):
    tag:         str
    id:          str
    text:        str
    aria_label:  str = ""
    aria_role:   str = ""
    voice_query: str = ""
    history:     list[Message] = []
    task:        str = ""
    task_step:   int = 0
    language:    str = "en"
    url:         str = ""
    parent_text: str = ""

TASKS = {
    "gmail_send_email": {
        "keywords": ["send email", "write email", "compose email", "send an email", "write an email"],
        "steps": [
            {"text": "First let's go to Gmail. Please type mail.google.com in your address bar at the top and press Enter.", "selector": ""},
            {"text": "Let's send an email! First click the Compose button on the left side — it's a big colourful button.", "selector": "div.T-I.T-I-KE.L3"},
            {"text": "Now click the To field and type the email address of the person you want to send to.", "selector": "textarea[name='to'], input[name='to'], div[aria-label='To recipients']"},
            {"text": "Now click the Subject field and type what your email is about.", "selector": "input[name='subjectbox']"},
            {"text": "Now click the big empty area and type your message.", "selector": "div[aria-label='Message Body'], div.Am.Al.editable"},
            {"text": "Great! Now click the Send button to send your email.", "selector": "div[data-tooltip*='Send'], div[aria-label*='Send']"},
            {"text": "Your email has been sent! Wonderful job!", "selector": ""},
        ],
        "hindi_steps": [
            "Sabse pehle Gmail kholen. Address bar mein mail.google.com type karein aur Enter dabayein.",
            "Chaliye email bhejte hain! Baayein taraf Compose ka button dhundein aur click karein.",
            "Ab To waale box mein us vyakti ka email address type karein jise email bhejna hai.",
            "Ab Subject box mein apne email ka vishay type karein.",
            "Ab neeche ke bade khali jagah mein apna sandesh type karein.",
            "Bahut achha! Ab Send button click karein email bhejne ke liye.",
            "Aapka email bhej diya gaya! Bahut badhiya kiya aapne!",
        ],
    },
    "gmail_read_email": {
        "keywords": ["read email", "check email", "open email", "check my email", "read my email"],
        "steps": [
            {"text": "Let's read your emails! Look at the list of emails in the middle of the screen and click on the one you want to read.", "selector": "tr.zA"},
            {"text": "You can now read your email. When you are done, click the back arrow at the top to go back to your inbox.", "selector": "div[data-tooltip='Back to Inbox']"},
            {"text": "You are back in your inbox. Well done!", "selector": ""},
        ],
    },
    "amazon_search": {
        "keywords": ["search amazon", "find something on amazon", "shop on amazon", "buy something", "search for a product", "find a product", "look for something on amazon"],
        "steps": [
            {"text": "Let's shop on Amazon! First click the search bar at the top of the page.", "selector": "input#twotabsearchtextbox, input[name='field-keywords']"},
            {"text": "Now type what you are looking for and press Enter on your keyboard.", "selector": "input#twotabsearchtextbox, input[name='field-keywords']"},
            {"text": "Great! You can see the results. Hover over any product and press the mic button to hear about it, then click the one you want.", "selector": "div[data-component-type='s-search-result']"},
            {"text": "You are viewing the product. If you want it, press the mic and say add to cart.", "selector": ""},
        ],
    },
    "amazon_add_to_cart": {
        "keywords": ["add to cart", "buy this", "i want this", "purchase this", "add this to cart", "get this"],
        "steps": [
            {"text": "Let's add this to your cart! Look for the yellow Add to Cart button on the right side and click it.", "selector": "input#add-to-cart-button, span#submit.a-button-text"},
            {"text": "It has been added to your cart! Say checkout when you are ready to buy or keep shopping.", "selector": ""},
        ],
    },
    "amazon_checkout": {
        "keywords": ["checkout", "buy now", "proceed to checkout", "pay now"],
        "steps": [
            {"text": "Let's checkout! Click the cart icon at the top right of the page.", "selector": "a#nav-cart"},
            {"text": "Now click the Proceed to Checkout button.", "selector": "input[name='proceedToRetailCheckout']"},
            {"text": "Follow the steps on screen to complete your purchase. I will be here if you need help!", "selector": ""},
        ],
    },
    "amazon_track_order": {
        "keywords": ["track order", "where is my order", "track my order", "check my order"],
        "steps": [
            {"text": "Let's track your order! Click on Returns and Orders at the top right of the page.", "selector": "a#nav-orders"},
            {"text": "You can see your recent orders here. Click on Track Package next to the order you want to track.", "selector": "a[data-action='a-expander-toggle']"},
            {"text": "You can now see where your package is. Well done!", "selector": ""},
        ],
    },
}

def detect_task(query: str) -> str | None:
    q = query.lower()
    for task_name, task_data in TASKS.items():
        for keyword in task_data["keywords"]:
            if keyword in q:
                return task_name
    return None

SYSTEM_PROMPT = (
    "You are a kind and patient friend helping an elderly person use the internet. "
    "Talk like a real person, not a computer. Use simple everyday words a grandparent would understand. "
    "Reply in ONE short friendly sentence only. No technical words. No bullet points. No lists. No code. "
    "IMPORTANT: If the element is SVG, img, or icon, look at the text content or aria-label to describe what it does, not what it is. "
    "For example if an SVG has aria-label 'Search' say 'This is the search button, click it to search'. "
    "If an icon has no label, say what its parent button does based on surrounding text. "
    "Never say 'SVG element' or 'HTML element' - always describe what it DOES not what it IS. "
    "Be warm, calm, and reassuring like talking to a family member."
)

SYSTEM_PROMPT_HINDI = (
    "Aap ek dost hain jo ek buzurg vyakti ko internet use karne mein madad kar rahe hain. "
    "Bilkul saral Hindi mein baat karein jaise ghar mein baat karte hain. "
    "Sirf EK choti si friendly sentence mein jawab dein. "
    "Koi technical shabd nahi. Warm aur helpful rahein."
)

VISUAL_TAGS = {"svg", "img", "picture", "canvas", "figure", "path", "circle", "rect"}

HINDI_TAG_RESPONSES = {
    "button":   "यह एक बटन है। इसे दबाने से कुछ काम होगा।",
    "a":        "यह एक लिंक है। इसे दबाने से आप दूसरे पेज पर जाएंगे।",
    "input":    "यह एक भरने वाला बॉक्स है। यहाँ कुछ टाइप करें।",
    "textarea": "यह एक बड़ा लिखने वाला बॉक्स है।",
    "img":      "यह एक तस्वीर है, मैं इसे देख नहीं सकता।",
    "svg":      "यह एक तस्वीर है, मैं इसे देख नहीं सकता।",
    "select":   "यह एक चुनने वाला बॉक्स है। क्लिक करके विकल्प चुनें।",
    "form":     "यह एक फॉर्म है जहाँ आप जानकारी भर सकते हैं।",
}

def text_to_audio_base64(text: str, language: str = "en") -> str:
    voice = "af_heart" if language != "hi" else "hf_alpha"
    samples, sample_rate = kokoro.create(
        text,
        voice=voice,
        speed=0.9,
        lang="hi" if language == "hi" else "en-us",
    )
    buffer = io.BytesIO()
    sf.write(buffer, samples, sample_rate, format="WAV")
    buffer.seek(0)
    return base64.b64encode(buffer.read()).decode("utf-8")

@app.post("/explain")
async def explain(data: ElementInfo):
    tag = data.tag.lower()
    question = data.voice_query if data.voice_query else "What is this?"

    # ── 1. New task detection ─────────────────────────────────────────────────
    if not data.task:
        detected = detect_task(question)
        if detected:
            task_data = TASKS[detected]
            steps = task_data["steps"]
            hindi_steps = task_data.get("hindi_steps", [])
            step = steps[0]
            text = hindi_steps[0] if data.language == "hi" and hindi_steps else step["text"]
            next_task = detected if len(steps) > 1 else ""
            next_step = 1 if next_task else 0
            print(f"[WebTutor] Task detected: {detected} | Starting step 1 | Lang: {data.language}")
            audio_base64 = text_to_audio_base64(text, data.language)
            return {"reply": text, "audio": audio_base64, "task": next_task, "task_step": next_step, "selector": step["selector"]}

    # ── 2. Task step progression ──────────────────────────────────────────────
    if data.task and data.task in TASKS:
        task_data = TASKS[data.task]
        steps = task_data["steps"]
        hindi_steps = task_data.get("hindi_steps", [])
        idx = data.task_step
        if idx < len(steps):
            step = steps[idx]
            text = hindi_steps[idx] if data.language == "hi" and idx < len(hindi_steps) else step["text"]
            is_last = (idx + 1) >= len(steps)
            next_task = "" if is_last else data.task
            next_step = 0 if is_last else idx + 1
            print(f"[WebTutor] Task: {data.task} | Step {idx + 1}/{len(steps)} | Lang: {data.language}")
            audio_base64 = text_to_audio_base64(text, data.language)
            return {"reply": text, "audio": audio_base64, "task": next_task, "task_step": next_step, "selector": step["selector"]}

    # ── 3. Normal element explanation ─────────────────────────────────────────

    # Hindi: skip LLM entirely, use hardcoded template
    if data.language == "hi":
        reply = HINDI_TAG_RESPONSES.get(tag, "यह पेज का एक हिस्सा है।")
        if data.text:
            reply += f" इसपर लिखा है: {data.text[:50]}"
        print(f"[WebTutor] Hindi template <{tag}>: {reply}")
        audio_base64 = text_to_audio_base64(reply, data.language)
        return {"reply": reply, "audio": audio_base64, "task": "", "task_step": 0, "selector": ""}

    context_parts = [f"The user is hovering over a <{tag}> element."]
    if data.text:
        context_parts.append(f"It says: '{data.text}'.")
    if not data.text and data.parent_text:
        context_parts.append(f"Its parent element says: '{data.parent_text}'.")
    if data.aria_label:
        context_parts.append(f"Its label is: '{data.aria_label}'.")
    if data.aria_role:
        context_parts.append(f"Its role is: '{data.aria_role}'.")
    if tag in VISUAL_TAGS:
        context_parts.append("This is a visual/image element.")
    if data.url:
        context_parts.append(f"The user is on the website: {data.url}.")

    context = " ".join(context_parts)

    messages = []
    for msg in data.history:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({
        "role": "user",
        "content": (
            f"{context}\n\n"
            f"The user asked: \"{question}\"\n\n"
            f"Reply in ONE short simple sentence only."
        )
    })

    print(f"[WebTutor] <{tag}> | Q: {question} | History: {len(data.history)} messages")

    try:
        t0 = time.time()
        system = SYSTEM_PROMPT_HINDI if data.language == "hi" else SYSTEM_PROMPT
        response = await AsyncClient().chat(
            model="llama3.2:latest",
            messages=messages,
            options={"system": system},
        )
        llm_time = time.time() - t0

        ai_reply = response["message"]["content"]
        match = re.search(r'[^.!?]*[.!?]', ai_reply)
        ai_reply = match.group(0).strip() if match else ai_reply.split('\n')[0].strip()

        t1 = time.time()
        audio_base64 = text_to_audio_base64(ai_reply, data.language)
        tts_time = time.time() - t1

        print(f"[WebTutor] Reply: {ai_reply}")
        print(f"[WebTutor] ⏱  LLM: {llm_time:.2f}s | TTS: {tts_time:.2f}s | Total: {(llm_time + tts_time):.2f}s")

        return {"reply": ai_reply, "audio": audio_base64, "task": "", "task_step": 0, "selector": ""}

    except Exception as e:
        ai_reply = "I am sorry, I am having trouble right now, please try again."
        print(f"[WebTutor] Error: {e}")
        return {"reply": ai_reply, "audio": None, "task": "", "task_step": 0, "selector": ""}

# To run: uv run python3 -m uvicorn main:app --reload