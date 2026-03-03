from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import ollama  

app = FastAPI() # initialize the FastAPI app

# add middleware to handle CORS (cross-origin resource sharing)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # allow requests from any origin
    allow_methods=["*"],  # allow all HTTP methods
    allow_headers=["*"],  # allow all headers
)

# define the data model for incoming requests
class ElementInfo(BaseModel):
    tag: str  # html tag name
    id: str   # element ID
    text: str # text content of the element

# system prompt for the AI model
SYSTEM_PROMPT = (
    "You are a patient, friendly tutor helping a senior citizen use the internet. "
    "The user will provide an html tag and text, but you must NOT mention 'html', 'tags', 'IDs', or 'code'. "
    "Instead, explain what the item DOES. For example, if it's a <button>, tell them 'This is a button you can click to submit your information.' "
    "Keep your explanation to 2 sentences and use very simple language."
)

# define the endpoint to explain html elements
@app.post("/explain")
async def explain(data: ElementInfo):
    try:
        # generate a response using the local AI model
        response = ollama.generate(
            model='llama3.2:1b', 
            system=SYSTEM_PROMPT,
            prompt=f"Explain this <{data.tag}> element with text: '{data.text}'"
        )
        ai_reply = response['response']
       
    except (ConnectionError, KeyError, ValueError) as e:
        # handle errors and provide a fallback reply
        ai_reply = "I'm sorry, I'm having trouble connecting to my local brain."
        print(f"local model error: {e}")

    # log the user's query for debugging
    print(f"user is asking about: {data.tag} (ID: {data.id})")
    return {"reply": ai_reply}
