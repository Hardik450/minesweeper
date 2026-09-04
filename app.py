import os
import uuid

from flask import Flask, jsonify, render_template, request, session

from minesweeper import Minesweeper, MinesweeperAI

HEIGHT = 8
WIDTH = 8
MINES = 8

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "dev-secret-key-change-me")

# In-memory game store, keyed by a per-browser session id.
# NOTE: this only works with a single gunicorn worker (see Procfile) — an
# in-memory dict isn't shared across processes. Fine for a small demo; swap
# for Redis or a DB if you need multi-worker / multi-instance scaling.
GAMES = {}


def new_game_state():
    return {
        "game": Minesweeper(height=HEIGHT, width=WIDTH, mines=MINES),
        "ai": MinesweeperAI(height=HEIGHT, width=WIDTH),
        "revealed": set(),
        "flags": set(),
        "lost": False,
    }


def get_game():
    sid = session.get("sid")
    if not sid or sid not in GAMES:
        sid = str(uuid.uuid4())
        session["sid"] = sid
        GAMES[sid] = new_game_state()
    return GAMES[sid]


def apply_move(g, cell):
    if g["game"].is_mine(cell):
        g["lost"] = True
    else:
        g["revealed"].add(cell)
        nearby = g["game"].nearby_mines(cell)
        g["ai"].add_knowledge(cell, nearby)


def state_payload(g, ai_message=None, move=None):
    revealed = {
        f"{i}_{j}": g["game"].nearby_mines((i, j)) for (i, j) in g["revealed"]
    }
    payload = {
        "height": g["game"].height,
        "width": g["game"].width,
        "mines_total": len(g["game"].mines),
        "flags_count": len(g["flags"]),
        "revealed": revealed,
        "flags": [list(c) for c in g["flags"]],
        "lost": g["lost"],
        "won": g["game"].mines == g["flags"],
    }
    if g["lost"]:
        payload["mines"] = [list(c) for c in g["game"].mines]
    if ai_message:
        payload["ai_message"] = ai_message
    if move is not None:
        payload["move"] = list(move)
    return payload


def parse_cell(data):
    cell = (int(data["row"]), int(data["col"]))
    return cell


@app.route("/")
def index():
    return render_template("index.html", height=HEIGHT, width=WIDTH, mines=MINES)


@app.route("/api/new_game", methods=["POST"])
def new_game():
    sid = session.get("sid") or str(uuid.uuid4())
    session["sid"] = sid
    GAMES[sid] = new_game_state()
    return jsonify(state_payload(GAMES[sid]))


@app.route("/api/state")
def state():
    return jsonify(state_payload(get_game()))


@app.route("/api/reveal", methods=["POST"])
def reveal():
    g = get_game()
    data = request.get_json(force=True, silent=True) or {}
    try:
        cell = parse_cell(data)
    except (KeyError, TypeError, ValueError):
        return jsonify({"error": "Malformed request"}), 400

    if g["lost"]:
        return jsonify({"error": "Game is already over"}), 400
    if not (0 <= cell[0] < g["game"].height and 0 <= cell[1] < g["game"].width):
        return jsonify({"error": "Out of bounds"}), 400
    if cell in g["flags"] or cell in g["revealed"]:
        return jsonify({"error": "Cell not available"}), 400

    apply_move(g, cell)
    return jsonify(state_payload(g, move=cell))


@app.route("/api/flag", methods=["POST"])
def flag():
    g = get_game()
    data = request.get_json(force=True, silent=True) or {}
    try:
        cell = parse_cell(data)
    except (KeyError, TypeError, ValueError):
        return jsonify({"error": "Malformed request"}), 400

    if g["lost"]:
        return jsonify({"error": "Game is already over"}), 400
    if cell in g["revealed"]:
        return jsonify({"error": "Cell already revealed"}), 400

    if cell in g["flags"]:
        g["flags"].remove(cell)
    else:
        g["flags"].add(cell)
    return jsonify(state_payload(g))


@app.route("/api/ai_move", methods=["POST"])
def ai_move():
    g = get_game()
    if g["lost"]:
        return jsonify({"error": "Game is already over"}), 400

    move = g["ai"].make_safe_move()
    if move is not None:
        apply_move(g, move)
        return jsonify(
            state_payload(g, ai_message="Known safe move.", move=move)
        )

    move = g["ai"].make_random_move()
    if move is not None:
        apply_move(g, move)
        return jsonify(
            state_payload(
                g, ai_message="No known safe cells — guessing.", move=move
            )
        )

    g["flags"] = g["ai"].mines.copy()
    return jsonify(state_payload(g, ai_message="No moves left to make."))


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
