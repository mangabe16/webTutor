from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import ollama
import time  # for timestamping logs
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

# define the data model for incoming requests
class ElementInfo(BaseModel):
    tag: str # html tag name
    id: str # element ID
    text: str # text content of the element

# system prompt for the AI model
SYSTEM_PROMPT = (
    "You are a kind internet tutor for older adults. The user is on {site_name}. "
    "They clicked a {tag} with the text '{text}'. The surrounding text on the page is "
    "'{parent_text}'. Explain the purpose of this element in one to two simple sentences"
)

# define the endpoint to explain html elements
@app.post("/explain")
async def explain(data: ElementInfo):
    start = time.perf_counter()  # start the clock to measure response time
    try:
        # generate a response using the local AI model
        response = ollama.generate(
            model='llama3.2:1b', 
            system=SYSTEM_PROMPT,
            prompt=f"Item type name: {data.tag}. Visible words on it: {data.text}. Explain to a beginner what this is for and what action they can take.'"
        )
        ai_reply = response['response']
       
    except (ConnectionError, KeyError, ValueError) as e:
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
