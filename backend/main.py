from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import logging  # for logging responses to a file

# Configure logging to save to a file
logging.basicConfig(
    filename='tutor.log',
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

app = FastAPI() # initialize the FastAPI app

# add middleware to handle CORS (cross-origin resource sharing)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # allow requests from any origin
    allow_methods=["*"],  # allow all HTTP methods
    allow_headers=["*"],  # allow all headers
)

class ElementInfo(BaseModel):
    tag: str # html tag name
    id: str  # element ID
    text: str # text content of the element
    aria_label: Optional[str] = None # ARIA label for accessibility
    alt_text: Optional[str] = None # Alt-text for images

# Dictionary mapping HTML tags to nouns
tag_descriptions = {
    "a": "a link",
    "button": "a button",
    "input": "a box",
    "img": "a picture or an image",
    "h1": "a main heading",
    "h2": "a sub-heading",
    "p": "a paragraph of text",
    "nav": "a navigation menu",
    "form": "a form",
    "span": "a small piece of text"
}

# define the endpoint to explain html elements
@app.post("/explain")
async def explain(data: ElementInfo):
    try:
        # Check for ARIA label or Alt-text first
        if data.aria_label:
            tag_description = tag_descriptions.get(data.tag, "an element")
            ai_reply = f"This is {tag_description} described as '{data.aria_label}'."
        elif data.alt_text:
            tag_description = tag_descriptions.get(data.tag, "an element")
            ai_reply = f"This is {tag_description} described as '{data.alt_text}'."
        else:
            # Fallback to dictionary mapping
            tag_description = tag_descriptions.get(data.tag, "an element")
            ai_reply = f"This is {tag_description}."
    except Exception as e:
        # handle errors and raise HTTPException with status code 500
        logging.error(f"Error: {e}")
        raise HTTPException(status_code=500, detail="An error occurred while processing your request.")

    # log the user's query for debugging
    logging.info(f"User is asking about: {data.tag} (ID: {data.id})")

    # append the AI's response to the log file
    logging.info("AI response: %s", ai_reply)

    return {"reply": ai_reply}
