from fastapi import FastAPI # core framework
from fastapi.middleware.cors import CORSMiddleware # middleware to handle CORS, allows to receive requests from different origins
from pydantic import BaseModel # basic class for data validation and serialization
from google import genai
from dotenv import load_dotenv # for loading content in .env file safely
import os
import google.generativeai as genai

# Load environment variables
load_dotenv()

# Retrieve the API key from the environment
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# fastAPI application that provides a simple API endpoint for explaining HTML elements
app = FastAPI() # create instance of FastAPI

# Enable CORS (so your browser extension can talk to backend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request schema
class ElementInfo(BaseModel):
    """
    represents information about an HTML/XML element.

    captures essential properties of a DOM element for serialization
    and data validation purposes.
    """

    tag: str  # HTML tag name (e.g., 'div', 'span', 'button')
    id: str  # unique identifier attribute of the element
    text: str  # the text content or inner HTML of the element

# System prompt
SYSTEM_PROMPT = (
    "You are a helpful web navigation tutor. "
    "Explain the element in very simple language for a senior citizen. "
    "Do not talk about anything else."
)

# Load Gemini model once (not per request)
model = genai.GenerativeModel("gemini-1.5-flash")

@app.post("/explain")
async def explain(data: ElementInfo):
    # combine the system prompt with user input
    content = f"[Rules] {SYSTEM_PROMPT} [User Input] {data.text}"

    # call the AI model
    response = client.models.generate_content(
        model="gemini-1.5-flash",
        contents=f"{SYSTEM_PROMPT}\n\nUser is looking at a {data.tag} with text: {data.text}"
    )

    # Extract the AI's reply
    if response and response.result:
        ai_reply = response.result
    else:
        ai_reply = "I'm sorry, I couldn't generate a response."

    print(f"User is asking about: {data.tag} (ID: {data.id})")

    return {"reply": ai_reply}