from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import ollama
import time  # for timestamping logs
import logging  # for logging responses to a file
from typing import Optional

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


# define the data model for incoming requests
class ElementInfo(BaseModel):
    tag: str
    id: str
    text: str
    aria_label: Optional[str] = ""
    alt_text: Optional[str] = ""
    site_name: str
    parent_text: str

# define the system prompt template
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
    start = time.perf_counter()  # start the clock
    # Fill the template with the actual data from the request
    filled_system_prompt = SYSTEM_PROMPT.format(
        site_name=data.site_name,
        tag=data.tag,
        text=data.text,
        parent_text=data.parent_text
    )

    try:
        response = ollama.generate(
            model='llama3.2:1b', 
            system=filled_system_prompt,
            prompt="In 15 words or less, what happens if I click this?",
            options={
                "temperature": 0.3, # Lower temperature makes it less "talkative" and more focused
                "num_predict": 50    # Hard limit on how many words it can generate
            }
        )
        ai_reply = response['response']
       
    except (ConnectionError, TimeoutError, KeyError, ValueError) as e:
        # handle errors and provide a fallback reply
        ai_reply = "I'm sorry, I'm having trouble connecting to my local brain."
        print(f"local model error: {e}")

    elapsed_ms = (time.perf_counter() - start) * 1000  # stop the clock and calculate the response time
    # log the user's query for debugging
    print(f"user is asking about: {data.tag} (ID: {data.id})")
    print(f"response time: {elapsed_ms:.2f} ms")

    # append the AI's response to the log file
    logging.info("AI response: %s", ai_reply)
    logging.info(f"response time: {elapsed_ms:.2f} ms")

    return {"reply": ai_reply}
