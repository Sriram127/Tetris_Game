const boardCanvas = document.getElementById("board");
const boardCtx = boardCanvas.getContext("2d");
const nextCanvas = document.getElementById("next");
const nextCtx = nextCanvas.getContext("2d");
const scoreEl = document.getElementById("score");
const linesEl = document.getElementById("lines");
const levelEl = document.getElementById("level");
const bestEl = document.getElementById("best");
const statusText = document.getElementById("statusText");
const overlay = document.getElementById("overlay");
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const restartBtn = document.getElementById("restartBtn");
const ghostToggle = document.getElementById("ghostToggle");
const soundToggle = document.getElementById("soundToggle");
const touchButtons = document.querySelectorAll(".touch-controls button");

const cols = 10;
const rows = 20;
const cell = 30;
const lineClearDuration = 420;
const colors = {
  I: "#4dd8ff",
  J: "#3f66ff",
  L: "#ff9f1c",
  O: "#ffd23f",
  S: "#38d97b",
  T: "#b15cff",
  Z: "#ff4f6d"
};
const shapes = {
  I: [[1, 1, 1, 1]],
  J: [[1, 0, 0], [1, 1, 1]],
  L: [[0, 0, 1], [1, 1, 1]],
  O: [[1, 1], [1, 1]],
  S: [[0, 1, 1], [1, 1, 0]],
  T: [[0, 1, 0], [1, 1, 1]],
  Z: [[1, 1, 0], [0, 1, 1]]
};
const scoreTable = [0, 100, 300, 500, 800];

let board;
let active;
let nextPiece;
let score;
let lines;
let level;
let best = Number(localStorage.getItem("tetrisBestScore")) || 0;
let state = "ready";
let dropCounter = 0;
let lastTime = 0;
let animationId = null;
let clearingRows = [];
let clearStartedAt = 0;
let pendingClearedCount = 0;
let particles = [];
let shakeUntil = 0;
let audioContext = null;

bestEl.textContent = best;

function createBoard() {
  return Array.from({ length: rows }, () => Array(cols).fill(""));
}

function randomPiece() {
  const types = Object.keys(shapes);
  const type = types[Math.floor(Math.random() * types.length)];
  return {
    type,
    matrix: shapes[type].map((row) => [...row]),
    x: Math.floor(cols / 2) - Math.ceil(shapes[type][0].length / 2),
    y: 0
  };
}

function resetGame() {
  cancelAnimationFrame(animationId);
  board = createBoard();
  active = randomPiece();
  nextPiece = randomPiece();
  score = 0;
  lines = 0;
  level = 1;
  state = "ready";
  dropCounter = 0;
  lastTime = 0;
  clearingRows = [];
  particles = [];
  updateStats();
  setStatus("Ready");
  pauseBtn.textContent = "II";
  setOverlay("Tetris", "Stack blocks and clear lines.", "Start Game", true);
  draw(0);
}

function startGame() {
  cancelAnimationFrame(animationId);
  board = createBoard();
  active = randomPiece();
  nextPiece = randomPiece();
  score = 0;
  lines = 0;
  level = 1;
  state = "playing";
  dropCounter = 0;
  lastTime = 0;
  clearingRows = [];
  particles = [];
  updateStats();
  setStatus("Playing");
  pauseBtn.textContent = "II";
  overlay.classList.add("hidden");
  animationId = requestAnimationFrame(update);
}

function resumeGame() {
  if (state !== "paused") {
    startGame();
    return;
  }
  state = "playing";
  lastTime = 0;
  setStatus("Playing");
  pauseBtn.textContent = "II";
  overlay.classList.add("hidden");
}

function update(time = 0) {
  const deltaTime = lastTime ? time - lastTime : 0;
  lastTime = time;

  if (state === "playing") {
    dropCounter += deltaTime;
    if (dropCounter > dropInterval()) {
      softDrop();
      dropCounter = 0;
    }
  }

  if (state === "clearing" && time - clearStartedAt >= lineClearDuration) {
    finishLineClear();
  }

  updateParticles(deltaTime);
  draw(time);

  if (state === "playing" || state === "paused" || state === "clearing") {
    animationId = requestAnimationFrame(update);
  }
}

function dropInterval() {
  return Math.max(95, 850 - (level - 1) * 70);
}

function softDrop() {
  if (state !== "playing") {
    return false;
  }
  active.y += 1;
  if (collides(active)) {
    active.y -= 1;
    lockPiece();
    return false;
  }
  return true;
}

function hardDrop() {
  if (state !== "playing") {
    return;
  }
  let distance = 0;
  while (!collides(active)) {
    active.y += 1;
    distance += 1;
  }
  active.y -= 1;
  score += Math.max(0, distance - 1) * 2;
  lockPiece();
  playTone(170, 0.06, "square");
}

function movePiece(dir) {
  if (state !== "playing") {
    return;
  }
  active.x += dir;
  if (collides(active)) {
    active.x -= dir;
    bump();
  }
  draw(performance.now());
}

function rotatePiece() {
  if (state !== "playing") {
    return;
  }
  if (active.type === "O") {
    playTone(320, 0.035, "triangle");
    return;
  }
  const original = active.matrix;
  active.matrix = rotate(original);
  const startX = active.x;
  const kicks = [0, -1, 1, -2, 2];

  for (const kick of kicks) {
    active.x = startX + kick;
    if (!collides(active)) {
      playTone(360, 0.04, "triangle");
      draw(performance.now());
      return;
    }
  }

  active.matrix = original;
  active.x = startX;
  bump();
}

function rotate(matrix) {
  return matrix[0].map((_, index) => matrix.map((row) => row[index]).reverse());
}

function collides(piece) {
  for (let y = 0; y < piece.matrix.length; y++) {
    for (let x = 0; x < piece.matrix[y].length; x++) {
      if (!piece.matrix[y][x]) {
        continue;
      }
      const nextX = piece.x + x;
      const nextY = piece.y + y;
      if (nextX < 0 || nextX >= cols || nextY >= rows) {
        return true;
      }
      if (nextY >= 0 && board[nextY][nextX]) {
        return true;
      }
    }
  }
  return false;
}

function lockPiece() {
  active.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (!value) {
        return;
      }
      const boardY = active.y + y;
      if (boardY >= 0) {
        board[boardY][active.x + x] = active.type;
      }
    });
  });

  const fullRows = findFullRows();
  if (fullRows.length > 0) {
    beginLineClear(fullRows);
    return;
  }

  spawnNextPiece();
}

function findFullRows() {
  const fullRows = [];
  for (let y = 0; y < rows; y++) {
    if (board[y].every(Boolean)) {
      fullRows.push(y);
    }
  }
  return fullRows;
}

function beginLineClear(fullRows) {
  state = "clearing";
  clearingRows = fullRows;
  pendingClearedCount = fullRows.length;
  clearStartedAt = performance.now();
  setStatus(fullRows.length === 4 ? "Tetris!" : "Clearing");
  spawnLineParticles(fullRows);
  playTone(560 + fullRows.length * 80, 0.12, "triangle");
}

function finishLineClear() {
  clearingRows
    .slice()
    .sort((a, b) => b - a)
    .forEach((row) => {
      board.splice(row, 1);
      board.unshift(Array(cols).fill(""));
    });

  lines += pendingClearedCount;
  score += scoreTable[pendingClearedCount] * level;
  level = Math.floor(lines / 10) + 1;
  clearingRows = [];
  pendingClearedCount = 0;
  updateStats();
  spawnNextPiece();
}

function spawnNextPiece() {
  active = nextPiece;
  nextPiece = randomPiece();
  dropCounter = 0;

  if (collides(active)) {
    gameOver();
    return;
  }

  state = "playing";
  setStatus("Playing");
  updateStats();
}

function gameOver() {
  state = "over";
  cancelAnimationFrame(animationId);
  if (score > best) {
    best = score;
    localStorage.setItem("tetrisBestScore", best);
  }
  updateStats();
  setStatus("Game Over");
  playTone(120, 0.2, "sawtooth");
  setOverlay("Game Over", `Score: ${score}`, "Play Again", true);
}

function togglePause() {
  if (state === "paused") {
    resumeGame();
    return;
  }
  if (state !== "playing") {
    return;
  }
  state = "paused";
  setStatus("Paused");
  pauseBtn.textContent = ">";
  setOverlay("Paused", "Take a breath. Your board is safe.", "Resume", true);
}

function draw(time) {
  drawBoard(time);
  drawGhost();
  if (state !== "over" && state !== "clearing") {
    drawPiece(active, boardCtx, cell);
  }
  drawParticles();
  drawNext();
}

function drawBoard(time) {
  const shaking = performance.now() < shakeUntil;
  const shakeX = shaking ? Math.sin(time / 18) * 3 : 0;
  boardCtx.save();
  boardCtx.translate(shakeX, 0);
  boardCtx.fillStyle = "#171c22";
  boardCtx.fillRect(-6, 0, boardCanvas.width + 12, boardCanvas.height);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const clearProgress = getClearProgress(y);
      if (clearProgress > 0) {
        drawClearingCell(x, y, board[y][x], clearProgress);
      } else {
        drawCell(boardCtx, x, y, board[y][x], cell);
      }
    }
  }

  boardCtx.strokeStyle = "#252e36";
  boardCtx.lineWidth = 1;
  for (let x = 0; x <= cols; x++) {
    boardCtx.beginPath();
    boardCtx.moveTo(x * cell, 0);
    boardCtx.lineTo(x * cell, boardCanvas.height);
    boardCtx.stroke();
  }
  for (let y = 0; y <= rows; y++) {
    boardCtx.beginPath();
    boardCtx.moveTo(0, y * cell);
    boardCtx.lineTo(boardCanvas.width, y * cell);
    boardCtx.stroke();
  }
  boardCtx.restore();
}

function getClearProgress(row) {
  if (!clearingRows.includes(row)) {
    return 0;
  }
  return Math.min(1, (performance.now() - clearStartedAt) / lineClearDuration);
}

function drawClearingCell(x, y, type, progress) {
  if (!type) {
    return;
  }
  const shrink = 1 - progress * 0.75;
  const flash = Math.sin(progress * Math.PI * 5) > 0 ? "#ffffff" : colors[type];
  const size = (cell - 4) * shrink;
  const px = x * cell + cell / 2 - size / 2;
  const py = y * cell + cell / 2 - size / 2;
  boardCtx.globalAlpha = 1 - progress * 0.2;
  boardCtx.fillStyle = flash;
  boardCtx.fillRect(px, py, size, size);
  boardCtx.globalAlpha = 1;
}

function drawPiece(piece, ctx, size, alpha = 1, offsetX = 0, offsetY = 0) {
  ctx.save();
  ctx.globalAlpha = alpha;
  piece.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        drawCell(ctx, piece.x + x + offsetX, piece.y + y + offsetY, piece.type, size);
      }
    });
  });
  ctx.restore();
}

function drawGhost() {
  if (!ghostToggle.checked || state !== "playing") {
    return;
  }
  const ghost = {
    ...active,
    matrix: active.matrix
  };
  while (!collides(ghost)) {
    ghost.y += 1;
  }
  ghost.y -= 1;
  drawPiece(ghost, boardCtx, cell, 0.18);
}

function drawCell(ctx, x, y, type, size) {
  if (!type || y < 0) {
    return;
  }
  const px = x * size;
  const py = y * size;
  const gradient = ctx.createLinearGradient(px, py, px + size, py + size);
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(0.12, colors[type]);
  gradient.addColorStop(1, shadeColor(colors[type], -22));
  ctx.fillStyle = gradient;
  ctx.fillRect(px + 2, py + 2, size - 4, size - 4);
  ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
  ctx.fillRect(px + 5, py + 5, size - 10, 5);
  ctx.strokeStyle = "rgba(0, 0, 0, 0.28)";
  ctx.strokeRect(px + 2, py + 2, size - 4, size - 4);
}

function drawNext() {
  nextCtx.fillStyle = "#171c22";
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  const size = 24;
  const piece = {
    ...nextPiece,
    x: Math.floor((nextCanvas.width / size - nextPiece.matrix[0].length) / 2),
    y: Math.floor((nextCanvas.height / size - nextPiece.matrix.length) / 2)
  };
  drawPiece(piece, nextCtx, size);
}

function spawnLineParticles(fullRows) {
  fullRows.forEach((row) => {
    for (let x = 0; x < cols; x++) {
      const type = board[row][x];
      for (let i = 0; i < 4; i++) {
        particles.push({
          x: x * cell + cell / 2,
          y: row * cell + cell / 2,
          vx: (Math.random() - 0.5) * 0.36,
          vy: -Math.random() * 0.42 - 0.08,
          life: 520 + Math.random() * 260,
          age: 0,
          color: colors[type] || "#ffffff",
          size: 3 + Math.random() * 4
        });
      }
    }
  });
}

function updateParticles(deltaTime) {
  particles = particles
    .map((particle) => ({
      ...particle,
      age: particle.age + deltaTime,
      x: particle.x + particle.vx * deltaTime,
      y: particle.y + particle.vy * deltaTime,
      vy: particle.vy + 0.00065 * deltaTime
    }))
    .filter((particle) => particle.age < particle.life);
}

function drawParticles() {
  particles.forEach((particle) => {
    const progress = particle.age / particle.life;
    boardCtx.globalAlpha = 1 - progress;
    boardCtx.fillStyle = particle.color;
    boardCtx.fillRect(particle.x, particle.y, particle.size, particle.size);
    boardCtx.globalAlpha = 1;
  });
}

function bump() {
  shakeUntil = performance.now() + 120;
  playTone(95, 0.035, "square");
}

function updateStats() {
  scoreEl.textContent = score;
  linesEl.textContent = lines;
  levelEl.textContent = level;
  bestEl.textContent = best;
}

function setStatus(text) {
  statusText.textContent = text;
}

function setOverlay(title, message, buttonText, show) {
  overlay.querySelector("h2").textContent = title;
  overlay.querySelector("p").textContent = message;
  startBtn.textContent = buttonText;
  overlay.classList.toggle("hidden", !show);
}

function shadeColor(hex, percent) {
  const value = parseInt(hex.slice(1), 16);
  const amount = Math.round(2.55 * percent);
  const r = Math.max(0, Math.min(255, (value >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((value >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (value & 255) + amount));
  return `rgb(${r}, ${g}, ${b})`;
}

function playTone(frequency, duration, type) {
  if (!soundToggle.checked) {
    return;
  }
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) {
    return;
  }
  audioContext = audioContext || new AudioContext();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.045, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft" || event.key === "a") {
    event.preventDefault();
    movePiece(-1);
  }
  if (event.key === "ArrowRight" || event.key === "d") {
    event.preventDefault();
    movePiece(1);
  }
  if (event.key === "ArrowDown" || event.key === "s") {
    event.preventDefault();
    if (softDrop()) {
      score += 1;
      updateStats();
      draw(performance.now());
    }
  }
  if (event.key === "ArrowUp" || event.key === "w") {
    event.preventDefault();
    rotatePiece();
  }
  if (event.key === " ") {
    event.preventDefault();
    hardDrop();
  }
  if (event.key === "p") {
    event.preventDefault();
    togglePause();
  }
});

touchButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const action = button.dataset.action;
    if (action === "left") {
      movePiece(-1);
    }
    if (action === "right") {
      movePiece(1);
    }
    if (action === "rotate") {
      rotatePiece();
    }
    if (action === "down" && softDrop()) {
      score += 1;
      updateStats();
      draw(performance.now());
    }
    if (action === "drop") {
      hardDrop();
    }
  });
});

startBtn.addEventListener("click", () => {
  if (state === "paused") {
    resumeGame();
  } else {
    startGame();
  }
});
restartBtn.addEventListener("click", startGame);
pauseBtn.addEventListener("click", togglePause);
ghostToggle.addEventListener("change", () => draw(performance.now()));

resetGame();
