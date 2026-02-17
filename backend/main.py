from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

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
    print(f"user is asking about: {data.tag} (ID: {data.id})")
    return {"reply": f"That is a {data.tag} button. It says '{data.text}'."}