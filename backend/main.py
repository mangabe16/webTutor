"""Web Tutor FastAPI backend — explains webpage elements to senior citizens."""

import re
import io
import base64
import time
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from ollama import AsyncClient

app = FastAPI()

from typing import Optional
import time  # for measuring response time
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

print("[WebTutor] Loading Kokoro voice model...")
kokoro = Kokoro("kokoro-v1.0.onnx", "voices-v1.0.bin")
print("[WebTutor] Kokoro ready!")

class Message(BaseModel):
    role: str
    content: str

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
    start = time.perf_counter()  # start the clock to measure response time
    try:
        # Check for ARIA label or Alt-text first
        if data.aria_label:
            tag_description = tag_descriptions.get(data.tag, "an element")
            tutor_reply = f"This is {tag_description} described as '{data.aria_label}'."
        elif data.alt_text:
            tag_description = tag_descriptions.get(data.tag, "an element")
            tutor_reply = f"This is {tag_description} described as '{data.alt_text}'."
        else:
            # Fallback to dictionary mapping
            tag_description = tag_descriptions.get(data.tag, "an element")
            tutor_reply = f"This is {tag_description}."
    except Exception as e:
        # handle errors and raise HTTPException with status code 500
        logging.error(f"Error: {e}")
        raise HTTPException(status_code=500, detail="An error occurred while processing your request.")

    elapsed_ms = (time.perf_counter() - start) * 1000  # stop the clock and calculate the response time
    # log the user's query for debugging
    logging.info(f"User is asking about: {data.tag} (ID: {data.id})")
    logging.info(f"Time required for this response: {elapsed_ms:.2f} ms")


    # append the AI's response to the log file
    logging.info("AI response: %s", tutor_reply)

    return {"reply": tutor_reply}