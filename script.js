(() => {
  const displayEl = document.getElementById("display");
  const expressionEl = document.getElementById("expression");
  const yearEl = document.getElementById("year");

  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  const state = {
    current: "0",
    previous: null,
    operator: null,
    overwrite: false,
  };

  const symbols = {
    "/": "÷",
    "*": "×",
    "-": "−",
    "+": "+",
  };

  function formatNumber(value) {
    if (!Number.isFinite(value)) return "错误";
    const str = String(value);
    if (str.includes("e")) return str;
    const [intPart, decPart] = str.split(".");
    const withComma = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return decPart !== undefined ? `${withComma}.${decPart}` : withComma;
  }

  function updateDisplay() {
    displayEl.textContent = formatNumber(
      state.current === "错误" ? NaN : Number(state.current)
    );
    if (state.current === "错误") {
      displayEl.textContent = "错误";
    }

    if (state.previous !== null && state.operator) {
      expressionEl.textContent = `${formatNumber(Number(state.previous))} ${symbols[state.operator]}`;
    } else {
      expressionEl.textContent = "";
    }
  }

  function inputDigit(digit) {
    if (state.current === "错误") clearAll();

    if (state.overwrite) {
      state.current = digit;
      state.overwrite = false;
      updateDisplay();
      return;
    }

    if (state.current === "0") {
      state.current = digit;
    } else if (state.current.replace("-", "").replace(".", "").length < 12) {
      state.current += digit;
    }
    updateDisplay();
  }

  function inputDecimal() {
    if (state.current === "错误") clearAll();

    if (state.overwrite) {
      state.current = "0.";
      state.overwrite = false;
      updateDisplay();
      return;
    }

    if (!state.current.includes(".")) {
      state.current += ".";
      updateDisplay();
    }
  }

  function clearAll() {
    state.current = "0";
    state.previous = null;
    state.operator = null;
    state.overwrite = false;
    updateDisplay();
  }

  function toggleSign() {
    if (state.current === "错误" || state.current === "0") return;
    state.current = state.current.startsWith("-")
      ? state.current.slice(1)
      : `-${state.current}`;
    updateDisplay();
  }

  function percent() {
    if (state.current === "错误") return;
    const value = Number(state.current) / 100;
    state.current = String(value);
    state.overwrite = true;
    updateDisplay();
  }

  function compute(a, b, operator) {
    switch (operator) {
      case "+":
        return a + b;
      case "-":
        return a - b;
      case "*":
        return a * b;
      case "/":
        return b === 0 ? NaN : a / b;
      default:
        return b;
    }
  }

  function setOperator(nextOperator) {
    if (state.current === "错误") return;

    const currentValue = Number(state.current);

    if (state.previous !== null && state.operator && !state.overwrite) {
      const result = compute(Number(state.previous), currentValue, state.operator);
      if (!Number.isFinite(result)) {
        state.current = "错误";
        state.previous = null;
        state.operator = null;
        state.overwrite = true;
        updateDisplay();
        return;
      }
      state.current = String(roundResult(result));
      state.previous = state.current;
    } else {
      state.previous = state.current;
    }

    state.operator = nextOperator;
    state.overwrite = true;
    updateDisplay();
  }

  function equals() {
    if (state.operator === null || state.previous === null || state.current === "错误") {
      return;
    }

    const result = compute(
      Number(state.previous),
      Number(state.current),
      state.operator
    );

    if (!Number.isFinite(result)) {
      state.current = "错误";
    } else {
      state.current = String(roundResult(result));
    }

    state.previous = null;
    state.operator = null;
    state.overwrite = true;
    updateDisplay();
  }

  function roundResult(value) {
    return Number(Number(value.toPrecision(12)));
  }

  document.querySelector(".keys").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const { action, value } = button.dataset;

    switch (action) {
      case "digit":
        inputDigit(value);
        break;
      case "decimal":
        inputDecimal();
        break;
      case "clear":
        clearAll();
        break;
      case "sign":
        toggleSign();
        break;
      case "percent":
        percent();
        break;
      case "operator":
        setOperator(value);
        break;
      case "equals":
        equals();
        break;
      default:
        break;
    }
  });

  document.addEventListener("keydown", (event) => {
    const { key } = event;

    if (/^\d$/.test(key)) {
      inputDigit(key);
      return;
    }

    if (key === ".") {
      inputDecimal();
      return;
    }

    if (key === "+" || key === "-" || key === "*" || key === "/") {
      event.preventDefault();
      setOperator(key);
      return;
    }

    if (key === "Enter" || key === "=") {
      event.preventDefault();
      equals();
      return;
    }

    if (key === "Escape" || key === "Delete") {
      clearAll();
      return;
    }

    if (key === "%") {
      percent();
    }
  });

  updateDisplay();
})();

(() => {
  const canvas = document.getElementById("snake-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("snake-score");
  const bestEl = document.getElementById("snake-best");
  const overlay = document.getElementById("snake-overlay");
  const overlayTitle = document.getElementById("snake-overlay-title");
  const overlayHint = document.getElementById("snake-overlay-hint");
  const startBtn = document.getElementById("snake-start");
  const pauseBtn = document.getElementById("snake-pause");

  const GRID = 16;
  const CELL = canvas.width / GRID;
  const BEST_KEY = "tamura-snake-best";
  const TICK_MS = 120;

  const DIRS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };

  const OPPOSITE = {
    up: "down",
    down: "up",
    left: "right",
    right: "left",
  };

  let snake = [];
  let direction = "right";
  let queuedDir = "right";
  let food = { x: 0, y: 0 };
  let score = 0;
  let best = Number(localStorage.getItem(BEST_KEY)) || 0;
  let running = false;
  let paused = false;
  let dead = false;
  let timer = null;

  bestEl.textContent = String(best);

  function showOverlay(title, hint) {
    overlayTitle.textContent = title;
    overlayHint.textContent = hint;
    overlay.classList.remove("is-hidden");
  }

  function hideOverlay() {
    overlay.classList.add("is-hidden");
  }

  function placeFood() {
    const occupied = new Set(snake.map((s) => `${s.x},${s.y}`));
    let x;
    let y;
    do {
      x = Math.floor(Math.random() * GRID);
      y = Math.floor(Math.random() * GRID);
    } while (occupied.has(`${x},${y}`));
    food = { x, y };
  }

  function resetGame() {
    const mid = Math.floor(GRID / 2);
    snake = [
      { x: mid - 1, y: mid },
      { x: mid - 2, y: mid },
      { x: mid - 3, y: mid },
    ];
    direction = "right";
    queuedDir = "right";
    score = 0;
    dead = false;
    paused = false;
    scoreEl.textContent = "0";
    placeFood();
    draw();
  }

  function drawCell(x, y, color, inset = 1.5) {
    ctx.fillStyle = color;
    ctx.beginPath();
    const r = 4;
    const px = x * CELL + inset;
    const py = y * CELL + inset;
    const size = CELL - inset * 2;
    ctx.roundRect(px, py, size, size, r);
    ctx.fill();
  }

  function draw() {
    ctx.fillStyle = "#102226";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "rgba(238, 246, 243, 0.04)";
    ctx.lineWidth = 1;
    for (let i = 1; i < GRID; i += 1) {
      ctx.beginPath();
      ctx.moveTo(i * CELL, 0);
      ctx.lineTo(i * CELL, canvas.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * CELL);
      ctx.lineTo(canvas.width, i * CELL);
      ctx.stroke();
    }

    drawCell(food.x, food.y, "#d4a373", 2.5);

    snake.forEach((segment, index) => {
      const color = index === 0 ? "#2f9e96" : "#1f6f6a";
      drawCell(segment.x, segment.y, color);
    });
  }

  function setDirection(next) {
    if (!DIRS[next]) return;
    if (OPPOSITE[direction] === next) return;
    queuedDir = next;
  }

  function tick() {
    if (!running || paused || dead) return;

    direction = queuedDir;
    const head = snake[0];
    const next = {
      x: head.x + DIRS[direction].x,
      y: head.y + DIRS[direction].y,
    };

    if (next.x < 0 || next.x >= GRID || next.y < 0 || next.y >= GRID) {
      endGame();
      return;
    }

    if (snake.some((s) => s.x === next.x && s.y === next.y)) {
      endGame();
      return;
    }

    snake.unshift(next);

    if (next.x === food.x && next.y === food.y) {
      score += 1;
      scoreEl.textContent = String(score);
      if (score > best) {
        best = score;
        bestEl.textContent = String(best);
        localStorage.setItem(BEST_KEY, String(best));
      }
      placeFood();
    } else {
      snake.pop();
    }

    draw();
  }

  function endGame() {
    dead = true;
    running = false;
    paused = false;
    clearInterval(timer);
    timer = null;
    startBtn.textContent = "再来一局";
    pauseBtn.disabled = true;
    pauseBtn.textContent = "暂停";
    showOverlay("游戏结束", `得分 ${score} · 空格再开`);
  }

  function start() {
    if (running && !paused && !dead) return;

    if (!running || dead) {
      resetGame();
      running = true;
      dead = false;
      paused = false;
      hideOverlay();
      startBtn.textContent = "重新开始";
      pauseBtn.disabled = false;
      pauseBtn.textContent = "暂停";
      clearInterval(timer);
      timer = setInterval(tick, TICK_MS);
      return;
    }

    if (paused) {
      paused = false;
      hideOverlay();
      pauseBtn.textContent = "暂停";
      clearInterval(timer);
      timer = setInterval(tick, TICK_MS);
    }
  }

  function togglePause() {
    if (!running || dead) return;

    if (paused) {
      start();
      return;
    }

    paused = true;
    clearInterval(timer);
    timer = null;
    pauseBtn.textContent = "继续";
    showOverlay("已暂停", "按 P 或点击继续");
  }

  startBtn.addEventListener("click", start);
  pauseBtn.addEventListener("click", togglePause);
  overlay.addEventListener("click", () => {
    if (paused) togglePause();
    else start();
  });

  document.querySelectorAll(".dpad-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!running || paused || dead) start();
      setDirection(btn.dataset.dir);
    });
  });

  document.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    const map = {
      arrowup: "up",
      w: "up",
      arrowdown: "down",
      s: "down",
      arrowleft: "left",
      a: "left",
      arrowright: "right",
      d: "right",
    };

    if (map[key]) {
      const section = document.getElementById("snake");
      const inView =
        section.getBoundingClientRect().top < window.innerHeight &&
        section.getBoundingClientRect().bottom > 0;
      if (!inView && !running) return;

      event.preventDefault();
      if (!running || dead) start();
      if (paused) start();
      setDirection(map[key]);
      return;
    }

    if (key === " " || key === "enter") {
      const section = document.getElementById("snake");
      const rect = section.getBoundingClientRect();
      if (rect.top >= window.innerHeight || rect.bottom <= 0) return;
      event.preventDefault();
      if (paused) togglePause();
      else start();
      return;
    }

    if (key === "p") {
      const section = document.getElementById("snake");
      const rect = section.getBoundingClientRect();
      if (rect.top >= window.innerHeight || rect.bottom <= 0) return;
      event.preventDefault();
      togglePause();
    }
  });

  resetGame();
  showOverlay("准备好了？", "按空格或点击开始");
})();
