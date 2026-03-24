# main.py — Branch: feature/voice-input
# Added: voice_query field so the AI can answer the user's specific question
# Run:  uv run uvicorn main:app --reload

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import ollama

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class ElementInfo(BaseModel):
    tag: str
    id: str
    text: str
    aria_label: str  = ""
    aria_role:  str  = ""
    voice_query: str = ""   # ← NEW: the question the user spoke aloud

SYSTEM_PROMPT = (
    "You are a friendly web navigation assistant helping a senior citizen "
    "understand a website. Give a clear, simple answer in 1-2 sentences. "
    "Never use technical terms like HTML, DOM, or CSS. "
    "Speak as if you're helping someone over the phone."
)

@app.post("/explain")
async def explain(data: ElementInfo):
    # Build the element description
    element_desc = f"a <{data.tag}> element"
    if data.aria_label:
        element_desc += f' labelled "{data.aria_label}"'
    if data.text:
        element_desc += f' with the text "{data.text[:150]}"'

    # If the user asked a specific question, answer that directly
    if data.voice_query:
        prompt = (
            f'The user is looking at {element_desc} on a webpage. '
            f'They asked: "{data.voice_query}". '
            f'Please answer their question about this element clearly and simply.'
        )
    else:
        prompt = (
            f'Please explain what {element_desc} is '
            f'and how to interact with it, in simple terms.'
        )

    try:
        response = ollama.generate(
            model="llama3.2:1b",
            system=SYSTEM_PROMPT,
            prompt=prompt,
        )
        reply = response["response"].strip()

    except ollama.RequestError as e:
        print(f"Ollama error: {e}")
        reply = "I'm sorry, I'm having trouble thinking right now. Please try again in a moment."

    print(f"[{data.tag}] Q: {data.voice_query!r} → {reply[:80]}…")
    return {"reply": reply}
