from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import logging
import ollama
import base64
import io
import scipy.io.wavfile as wavfile
from kokoro_onnx import Kokoro

# Configure logging
logging.basicConfig(filename='tutor.log', level=logging.INFO, format='%(asctime)s - %(message)s')

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# Load Voice Model
kokoro = Kokoro("kokoro-v1.0.onnx", "voices-v1.0.bin")

class Message(BaseModel):
    role: str
    content: str

class ElementInfo(BaseModel):
    tag: str
    id: str
    text: str
    aria_label: Optional[str] = ""
    site_name: str = "Unknown"
    parent_text: str = ""
    mode: str = "rule-based" 
    voice_query: Optional[str] = ""
    history: List[Message] = []

tag_descriptions = {"a": "a link", "button": "a button", "img": "an image"}

# System prompt template for LLM mode
SYSTEM_PROMPT = """You are a simple voice assistant for seniors.
Your goal is to explain what a specific button or link DOES on the current website, not what the HTML tag is.
RULES:
1. NEVER mention technical terms like 'HTML', 'span', 'tag', or 'element'.
2. Use ONLY 1 short sentence.
3. If the site is {site_name}, explain the action in the context of that site.
Context: Site: {site_name}, Text: {text}, Surrounding: {parent_text}.
"""

@app.post("/explain")
async def explain(data: ElementInfo):
    # 1. Determine the Text Reply
    if data.mode == "rule-based":
        base = tag_descriptions.get(data.tag, "an element")
        reply = f"This is {base}."
        if data.aria_label: 
            reply += f" It's labeled '{data.aria_label}'."
    else: # if LLM mode was chosen
        try:
            # Use the voice_query if it exists, otherwise use a default prompt
            user_task = data.voice_query if data.voice_query else "Explain this item."
            system_prompt = SYSTEM_PROMPT.format(
                site_name=data.site_name,
                text=data.text,
                parent_text=data.parent_text,
            )
            
            response = ollama.generate(
                model='llama3.2:1b',
                system=system_prompt,
                prompt=f"User asked: '{user_task}'. Element: <{data.tag}>. Text: '{data.text}'. Context: '{data.parent_text}'"
            )
            reply = response['response'].strip()
        except Exception as e:
            logging.error(f"Ollama Error: {e}")
            reply = "My AI brain is offline. This is a " + tag_descriptions.get(data.tag, "item")

    # 2. Generate Kokoro Audio
    try:
        # Generate raw audio samples
        samples, sample_rate = kokoro.create(reply, voice="af_bella", speed=1.0, lang="en-us")
        
        # Convert NumPy array to WAV in memory
        buffered = io.BytesIO()
        wavfile.write(buffered, sample_rate, samples)
        
        # Encode to Base64 string for the Chrome Extension
        audio_b64 = base64.b64encode(buffered.getvalue()).decode('utf-8')
    except Exception as e:
        logging.error(f"TTS Error: {e}")
        audio_b64 = None

    logging.info(f"Mode: {data.mode} | Reply: {reply}")
    return {"reply": reply, "audio": audio_b64}