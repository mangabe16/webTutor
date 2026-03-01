from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import ollama  # The library for local AI

# fastAPI application that provides a local API endpoint for explaining HTML elements
app = FastAPI()

# Enable CORS so your browser extension can talk to your local server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_methods=["*"],
    allow_headers=["*"],
)
class ElementInfo(BaseModel):
    """
    Validates the incoming data from the browser extension.
    """
    tag: str
    id: str
    text: str

# local system prompt
SYSTEM_PROMPT = (
    "You are a helpful web navigation tutor. Your job is to explain the following "
    "element to a senior citizen. Do not talk about anything else."
)

@app.post("/explain")
async def explain(data: ElementInfo):
    """
    Sends the element data to our local model and returns the explanation.
    """
    try:
        # Use the 'generate' method for a single, direct response
        response = ollama.generate(
            model='llama3.2:1b',  # Ensure you have run 'ollama pull llama3.2:1b'
            system=SYSTEM_PROMPT,
            prompt=f"Explain this <{data.tag}> element that has the text: '{data.text}'"
        )

        ai_reply = response['response']
        print(f"User is asking about: {data.tag} (ID: {data.id})")
        
    except ollama.RequestError as e:
        ai_reply = "I'm sorry, I'm having trouble connecting to my local brain right now."
        print(f"Error calling local model: {e}")

    # Extract the AI's reply
    if response and response.result:
        ai_reply = response.result
    else:
        ai_reply = "I'm sorry, I couldn't generate a response."

    print(f"User is asking about: {data.tag} (ID: {data.id})")
    return {"reply": ai_reply}
