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

SYSTEM_PROMPT = (
    "You are a kind and patient friend helping an elderly person use the internet. "
    "Talk like a real person, not a computer. Use simple everyday words a grandparent would understand. "
    "Reply in ONE short friendly sentence only. No technical words. No bullet points. No lists. No code. "
    "If something is an image, icon, SVG or picture say: 'I can see this is a picture but I cannot see what it shows.' "
    "Never guess what an element does if you are not sure — just say what it looks like. "
    "Be warm, calm, and reassuring like talking to a family member."
)

VISUAL_TAGS = {"svg", "img", "picture", "canvas", "figure", "path", "circle", "rect"}

def text_to_audio_base64(text: str) -> str:
    samples, sample_rate = kokoro.create(
        text,
        voice="af_heart",
        speed=0.9,
        lang="en-us",
    )
    buffer = io.BytesIO()
    sf.write(buffer, samples, sample_rate, format="WAV")
    buffer.seek(0)
    return base64.b64encode(buffer.read()).decode("utf-8")

@app.post("/explain")
async def explain(data: ElementInfo):
    tag = data.tag.lower()
    question = data.voice_query if data.voice_query else "What is this?"

    context_parts = [f"The user is hovering over a <{tag}> element."]
    if data.text:
        context_parts.append(f"It says: '{data.text}'.")
    if data.aria_label:
        context_parts.append(f"Its label is: '{data.aria_label}'.")
    if data.aria_role:
        context_parts.append(f"Its role is: '{data.aria_role}'.")
    if tag in VISUAL_TAGS:
        context_parts.append("This is a visual/image element.")

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
        # ── Time the LLM call ──
        t0 = time.time()
        response = await AsyncClient().chat(
            model="llama3.2:latest",
            messages=messages,
            options={"system": SYSTEM_PROMPT},
        )
        llm_time = time.time() - t0

        ai_reply = response["message"]["content"]
        match = re.search(r'[^.!?]*[.!?]', ai_reply)
        ai_reply = match.group(0).strip() if match else ai_reply.split('\n')[0].strip()

        # ── Time the Kokoro call ──
        t1 = time.time()
        audio_base64 = text_to_audio_base64(ai_reply)
        tts_time = time.time() - t1

        print(f"[WebTutor] Reply: {ai_reply}")
        print(f"[WebTutor] ⏱  LLM: {llm_time:.2f}s | TTS: {tts_time:.2f}s | Total: {(llm_time + tts_time):.2f}s")

        return {"reply": ai_reply, "audio": audio_base64}

    except Exception as e:
        ai_reply = "I am sorry, I am having trouble right now, please try again."
        print(f"[WebTutor] Error: {e}")
        return {"reply": ai_reply, "audio": None}

# To run: uv run python3 -m uvicorn main:app --reload