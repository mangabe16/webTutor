from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google.generativeai import palm
from dotenv import load_dotenv
import os

# Load environment variables from .env file
load_dotenv()

# Retrieve the API key from the environment
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Set the API key for the palm library
palm.configure(api_key=GEMINI_API_KEY)

# fastAPI application that provides a simple API endpoint for explaining HTML elements

app = FastAPI() # create instance of FastAPI

# enable CORS so your browser extension can talk to your local server
# allow server to accept requests from any origin, any HTTTP, and any headers
app.add_middleware( # adding CORS middleware to the app
    CORSMiddleware,
    allow_origins=["*"],  # in production, replace "*" with specific origins
    allow_methods=["*"],
    allow_headers=["*"],
)

class ElementInfo(BaseModel):
    """
    represents information about an HTML/XML element.

    this model captures essential properties of a DOM element for serialization
    and data validation purposes.
    """

    tag: str  #     cat .gitignore    cat .gitignore    cat .gitignore/XML tag name (e.g., 'div', 'span', 'button')
    id: str  # unique identifier attribute of the element
    text: str  # the text content or inner HTML of the element

# define a system prompt
SYSTEM_PROMPT = "You are a helpful web navigation tutor. Your job is to explain the following element " \
"to a senior citizen. Do not talk about anything else."

@app.post("/explain")
async def explain(data: ElementInfo):
    # combine the system prompt with user input
    content = f"[Rules] {SYSTEM_PROMPT} [User Input] {data.text}"

    # call the AI model
    response = palm.generate_text(
        model="text-bison-001",  # specify the model name
        prompt=content,
        temperature=0.7,  # adjust temperature for creativity
        max_output_tokens=100  # limit the response length
    )

    # Extract the AI's reply
    if response and response.result:
        ai_reply = response.result
    else:
        ai_reply = "I'm sorry, I couldn't generate a response."

    print(f"User is asking about: {data.tag} (ID: {data.id})")
    return {"reply": ai_reply}