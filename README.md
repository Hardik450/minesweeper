# Minesweeper (Flask)

A web version of the pygame Minesweeper project. `minesweeper.py`
(`Minesweeper`, `Sentence`, `MinesweeperAI`) is unchanged — it runs behind a
small Flask API instead of a pygame loop.

## Project structure

```
app.py                Flask app + API routes
minesweeper.py         Game logic and knowledge-based AI (unchanged from the original)
templates/index.html   Page markup
static/style.css       Styling
static/script.js       Frontend game logic (fetches from the API)
requirements.txt       Python deps
Procfile                 Tells Render how to start the app
```

## How game state is stored

Each browser gets a session cookie holding a game id; the actual
`Minesweeper`/`MinesweeperAI` objects live in an in-memory dict on the
server (`GAMES` in `app.py`). That's why the `Procfile` runs a **single**
gunicorn worker — an in-memory dict isn't shared across processes. Fine for
personal/demo use; if you need multiple workers or instances, swap that
dict for Redis or a database.

## Run locally

```bash
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Visit http://localhost:5000

## Deploy on Render

1. Push this folder to a GitHub repo.
2. In Render: **New +** → **Web Service** → connect the repo.
3. Settings:
   - **Environment**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app --workers 1 --threads 4` (already
     set via the `Procfile`)
4. Optionally set a `SECRET_KEY` environment variable (used to sign the
   session cookie — a default is provided but you should override it in
   production).
5. Deploy. Render sets `PORT` automatically, and `app.py` already reads it.
