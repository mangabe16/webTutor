from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import ollama  # The library for local AI

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

SYSTEM_PROMPT = (
    "You are a helpful web navigation tutor. Your job is to explain the following "
    "element to a senior citizen. Do not talk about anything else."
)

@app.post("/explain")
async def explain(data: ElementInfo):
    try:
        response = ollama.generate(
            model='llama3.2:1b', 
            system=SYSTEM_PROMPT,
            prompt=f"Explain this <{data.tag}> element with text: '{data.text}'"
        )
        ai_reply = response['response']
        
    except Exception as e:
        ai_reply = "I'm sorry, I'm having trouble connecting to my local brain."
        print(f"Local Model Error: {e}")

    print(f"User is asking about: {data.tag} (ID: {data.id})")
    return {"reply": ai_reply}