# Rule - based approach

# Sample output
2026-03-19 14:28:43,381 - INFO - User is asking about: a (ID: nav-logo-sprites)
2026-03-19 14:28:43,381 - INFO - AI response: This is a link described as 'Amazon'.
2026-03-19 14:28:46,927 - INFO - User is asking about: span (ID: no-id)
2026-03-19 14:28:46,928 - INFO - AI response: This is a small piece of text.
2026-03-19 14:28:50,043 - INFO - User is asking about: img (ID: no-id)
2026-03-19 14:28:50,043 - INFO - AI response: This is a picture or an image described as 'Dresses'.


## For collaborators

### Naming convention for branches

    - feature/branch-name/name-of-feature

### To run

    - In one terminal run:
        uv run uvicorn backend.main:app --reload
    This command launches our web server, and watches for changes, so if source code is changed, no need to reload terminal
    
    Make sure these commands are being run from the directive of the project

    Go to chrome://extensions/, ensure "Web Tutor Phase 1" is toggled ON, and click the Refresh icon to make sure it has your latest content.js.
