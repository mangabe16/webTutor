## For collaborators

### Naming convention for branches
    - feature/branch-name/name-of-feature

### To run: 
    - In one terminal run:
        uv run uvicorn backend.main:app --reload
    This command launches our web server, and watches for changes, so if source code is changed, no need to reload terminal
    - In another terminal run:
        ollama serve
    This command starts the local server that listens for AI requests at a local host
    Make sure these commands are being run from the directive of the project

    Go to chrome://extensions/, ensure "Web Tutor Phase 1" is toggled ON, and click the Refresh icon to make sure it has your latest content.js.
