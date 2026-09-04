const briefingEl = document.getElementById("briefing");
const gameEl = document.getElementById("game");
const boardEl = document.getElementById("board");
const statusText = document.getElementById("statusText");
const minesText = document.getElementById("minesText");
const aiMessageEl = document.getElementById("aiMessage");
const beginBtn = document.getElementById("beginBtn");
const aiMoveBtn = document.getElementById("aiMoveBtn");
const resetBtn = document.getElementById("resetBtn");

let height = 8;
let width = 8;
let minesTotal = 8;
let cellEls = [];

function buildBoard() {
  boardEl.innerHTML = "";
  boardEl.style.setProperty("--cols", width);
  cellEls = [];
  for (let i = 0; i < height; i++) {
    const row = [];
    for (let j = 0; j < width; j++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.row = i;
      cell.dataset.col = j;
      cell.addEventListener("click", () => onReveal(i, j));
      cell.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        onFlag(i, j);
      });
      boardEl.appendChild(cell);
      row.push(cell);
    }
    cellEls.push(row);
  }
}

function clearMoveHighlight() {
  boardEl.querySelectorAll(".just-moved").forEach((c) => c.classList.remove("just-moved"));
}

function renderState(data) {
  height = data.height;
  width = data.width;
  minesTotal = data.mines_total;

  // Reset all cells to covered before re-applying revealed/flagged state.
  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
      const cell = cellEls[i][j];
      cell.className = "cell";
      cell.removeAttribute("data-count");
      cell.innerHTML = "";
    }
  }

  for (const [key, count] of Object.entries(data.revealed)) {
    const [i, j] = key.split("_").map(Number);
    const cell = cellEls[i][j];
    cell.classList.add("revealed");
    if (count > 0) {
      cell.dataset.count = count;
      cell.textContent = count;
    }
  }

  for (const [i, j] of data.flags) {
    const cell = cellEls[i][j];
    cell.innerHTML = flagIcon();
  }

  if (data.lost && data.mines) {
    for (const [i, j] of data.mines) {
      const cell = cellEls[i][j];
      cell.classList.add("lost");
      if (!cell.classList.contains("revealed")) {
        cell.innerHTML = mineIcon();
      }
    }
  }

  clearMoveHighlight();
  if (data.move) {
    const [i, j] = data.move;
    cellEls[i][j].classList.add("just-moved");
  }

  if (data.lost) {
    statusText.textContent = "Lost";
    disableBoard();
  } else if (data.won) {
    statusText.textContent = "Cleared";
    disableBoard();
  } else {
    statusText.textContent = "Surveying…";
  }

  minesText.textContent = `${data.flags_count} / ${minesTotal} flagged`;
  aiMessageEl.textContent = data.ai_message || "";
}

function disableBoard() {
  boardEl.classList.add("game-over");
}

function flagIcon() {
  return `<svg class="flag" viewBox="0 0 24 24"><path d="M5 3v18" stroke="#c1443b" stroke-width="2" stroke-linecap="round" fill="none"/><path d="M5 4 L18 8 L5 13 Z" fill="#c1443b"/></svg>`;
}

function mineIcon() {
  return `<svg class="mine" viewBox="0 0 24 24"><circle cx="12" cy="12" r="6" fill="#1f2a24"/><g stroke="#1f2a24" stroke-width="2"><line x1="12" y1="2" x2="12" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/></g></svg>`;
}

async function postJSON(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function onReveal(i, j) {
  if (boardEl.classList.contains("game-over")) return;
  try {
    const data = await postJSON("/api/reveal", { row: i, col: j });
    renderState(data);
  } catch (err) {
    // Invalid clicks (already revealed/flagged) are silently ignored.
  }
}

async function onFlag(i, j) {
  if (boardEl.classList.contains("game-over")) return;
  try {
    const data = await postJSON("/api/flag", { row: i, col: j });
    renderState(data);
  } catch (err) {
    // ignore
  }
}

async function onAiMove() {
  if (boardEl.classList.contains("game-over")) return;
  try {
    const data = await postJSON("/api/ai_move");
    renderState(data);
  } catch (err) {
    aiMessageEl.textContent = "AI move failed — try again.";
  }
}

async function startGame() {
  briefingEl.classList.add("hidden");
  gameEl.classList.remove("hidden");
  const data = await postJSON("/api/new_game");
  height = data.height;
  width = data.width;
  boardEl.classList.remove("game-over");
  buildBoard();
  renderState(data);
}

beginBtn.addEventListener("click", startGame);
aiMoveBtn.addEventListener("click", onAiMove);
resetBtn.addEventListener("click", startGame);
