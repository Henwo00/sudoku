const UI = (() => {
  let cellEls = [];
  let numBtns = [];
  let animQueue = [];
  let animRunning = false;

  // ── Bootstrap ────────────────────────────────────────────────────────────────

  function init() {
    buildBoard();
    buildNumpad();
    bindEvents();
    refreshBestTimes();
    checkResumeBanner();

    Game.onStateChange = (state, event) => {
      render(state, event);
      if (event !== 'tick') Game.saveProgress();
    };
  }

  // ── DOM Construction ─────────────────────────────────────────────────────────

  function buildBoard() {
    const board = document.getElementById('board');
    board.innerHTML = '';
    cellEls = [];

    for (let i = 0; i < 81; i++) {
      const row = Math.floor(i / 9), col = i % 9;
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.idx = i;
      cell.dataset.row = row;
      cell.dataset.col = col;

      const valEl = document.createElement('span');
      valEl.className = 'cell-value';

      const notesEl = document.createElement('div');
      notesEl.className = 'cell-notes';
      notesEl.style.display = 'none';
      for (let n = 1; n <= 9; n++) {
        const nd = document.createElement('span');
        nd.className = 'note-digit';
        nd.dataset.note = n;
        nd.textContent = n;
        notesEl.appendChild(nd);
      }

      cell.appendChild(valEl);
      cell.appendChild(notesEl);
      cell.addEventListener('click', () => Game.select(i));
      board.appendChild(cell);
      cellEls.push(cell);
    }
  }

  function buildNumpad() {
    const pad = document.getElementById('numpad');
    pad.innerHTML = '';
    numBtns = [];

    for (let d = 1; d <= 9; d++) {
      const btn = document.createElement('button');
      btn.className = 'num-btn';
      btn.dataset.digit = d;

      const numEl = document.createElement('span');
      numEl.textContent = d;

      const countEl = document.createElement('span');
      countEl.className = 'num-count';

      btn.appendChild(numEl);
      btn.appendChild(countEl);
      btn.addEventListener('click', () => Game.inputDigit(d));
      pad.appendChild(btn);
      numBtns.push(btn);
    }
  }

  // ── Event Binding ─────────────────────────────────────────────────────────────

  function bindEvents() {
    document.querySelectorAll('.difficulty-card').forEach(card => {
      card.addEventListener('click', () => startGame(card.dataset.difficulty));
    });

    document.getElementById('resume-btn').addEventListener('click', resumeSavedGame);

    document.getElementById('back-btn').addEventListener('click', () => {
      Game.saveProgress();
      showScreen('menu-screen');
    });

    document.getElementById('pause-btn').addEventListener('click', () => Game.togglePause());
    document.getElementById('resume-game-btn').addEventListener('click', () => Game.togglePause());

    document.getElementById('undo-btn').addEventListener('click', () => Game.undo());
    document.getElementById('erase-btn').addEventListener('click', () => Game.erase());
    document.getElementById('notes-btn').addEventListener('click', () => Game.toggleMode());

    document.getElementById('win-new-btn').addEventListener('click', () => {
      hideModal('win-modal'); showScreen('menu-screen');
    });
    document.getElementById('win-same-btn').addEventListener('click', () => {
      hideModal('win-modal'); startGame(Game.lastDifficulty);
    });
    document.getElementById('fail-new-btn').addEventListener('click', () => {
      hideModal('fail-modal'); showScreen('menu-screen');
    });
    document.getElementById('fail-retry-btn').addEventListener('click', () => {
      hideModal('fail-modal'); startGame(Game.lastDifficulty);
    });

    document.addEventListener('keydown', onKey);
  }

  function onKey(e) {
    const state = Game.getState();
    if (!state) return;

    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); Game.undo(); return; }
    if (e.key === 'Escape') { Game.togglePause(); return; }
    if (e.key === 'n' || e.key === 'N') { Game.toggleMode(); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { Game.erase(); return; }
    if (e.key >= '1' && e.key <= '9') { Game.inputDigit(parseInt(e.key)); return; }

    const idx = state.selected;
    const dirs = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 };
    if (dirs[e.key] !== undefined) {
      e.preventDefault();
      if (idx === null) { Game.select(0); return; }
      const row = Math.floor(idx / 9), col = idx % 9;
      if (e.key === 'ArrowUp')    Game.select(((row - 1 + 9) % 9) * 9 + col);
      if (e.key === 'ArrowDown')  Game.select(((row + 1) % 9) * 9 + col);
      if (e.key === 'ArrowLeft')  Game.select(row * 9 + (col - 1 + 9) % 9);
      if (e.key === 'ArrowRight') Game.select(row * 9 + (col + 1) % 9);
    }
  }

  // ── Game Flow ─────────────────────────────────────────────────────────────────

  function startGame(difficulty) {
    Game.clearProgress();
    showScreen('generating-screen');
    // Two rAF calls ensure the generating screen is painted before blocking
    requestAnimationFrame(() => requestAnimationFrame(() => {
      Game.init(difficulty);
      animQueue = [];
      animRunning = false;
      render(Game.getState(), 'init');
      showScreen('game-screen');
    }));
  }

  function resumeSavedGame() {
    const saved = Game.loadProgress();
    if (!saved) return;
    showScreen('generating-screen');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      animQueue = [];
      animRunning = false;
      Game.init(null, saved);
      render(Game.getState(), 'init');
      showScreen('game-screen');
    }));
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  function render(state, event) {
    if (!state) return;

    document.getElementById('timer').textContent = Game.formatTime(state.elapsed);
    document.getElementById('difficulty-label').textContent = capitalize(state.difficulty);

    const mc = document.getElementById('mistake-counter');
    mc.textContent = `✕ ${state.mistakes}/3`;
    mc.classList.toggle('has-error', state.mistakes > 0);

    document.getElementById('pause-btn').textContent = state.paused ? '▶' : '⏸';
    document.getElementById('pause-overlay').classList.toggle('hidden', !state.paused);
    document.getElementById('notes-btn').classList.toggle('active', state.mode === 'notes');

    const conflicts = Game.getConflicts();
    const selVal = state.selected !== null ? state.board[state.selected] : 0;

    cellEls.forEach((cell, i) => {
      const val = state.board[i];
      const isGiven = state.given[i];
      const isSel = state.selected === i;
      const isRelated = state.selected !== null && !isSel && relatedTo(i, state.selected);
      const isSameDigit = selVal !== 0 && val === selVal && !isSel;
      const isConflict = conflicts.has(i);

      // Reset and apply state classes
      cell.className = 'cell';
      if (isGiven)     cell.classList.add('given');
      if (state.locked) cell.classList.add('locked');
      if (isSel)        cell.classList.add('selected');
      else if (isSameDigit) cell.classList.add('same-digit');
      else if (isRelated)   cell.classList.add('related');
      if (isConflict)   cell.classList.add('conflict');

      // Value vs notes
      const valEl = cell.querySelector('.cell-value');
      const notesEl = cell.querySelector('.cell-notes');

      if (val !== 0) {
        valEl.textContent = val;
        notesEl.style.display = 'none';
      } else {
        valEl.textContent = '';
        if (state.notes[i].size > 0) {
          notesEl.style.display = 'grid';
          notesEl.querySelectorAll('.note-digit').forEach(nd => {
            nd.classList.toggle('active', state.notes[i].has(+nd.dataset.note));
          });
        } else {
          notesEl.style.display = 'none';
        }
      }
    });

    // Numpad remaining counts
    const counts = new Array(10).fill(0);
    state.board.forEach(v => { if (v > 0) counts[v]++; });
    numBtns.forEach((btn, i) => {
      const rem = 9 - counts[i + 1];
      btn.querySelector('.num-count').textContent = rem > 0 ? rem : '';
      btn.disabled = rem <= 0 || state.locked;
    });

    // Triggered animations
    if (event === 'place' && state.selected !== null) {
      const units = Game.getCompletedUnits(state.selected);
      if (units.length > 0) queueFlash(units, state.selected);
    }

    if (event === 'win') {
      triggerWinCascade(() => showWinModal(state));
    }

    if (event === 'fail') {
      setTimeout(() => showModal('fail-modal'), 500);
    }
  }

  function relatedTo(a, b) {
    const ra = Math.floor(a / 9), ca = a % 9;
    const rb = Math.floor(b / 9), cb = b % 9;
    return ra === rb || ca === cb ||
      (Math.floor(ra / 3) === Math.floor(rb / 3) && Math.floor(ca / 3) === Math.floor(cb / 3));
  }

  // ── Animations ────────────────────────────────────────────────────────────────

  function queueFlash(units, triggerIdx) {
    units.forEach(cells => animQueue.push({ cells, triggerIdx }));
    if (!animRunning) drainAnimQueue();
  }

  function drainAnimQueue() {
    if (animQueue.length === 0) { animRunning = false; return; }
    animRunning = true;

    const { cells, triggerIdx } = animQueue.shift();
    const trigRow = Math.floor(triggerIdx / 9), trigCol = triggerIdx % 9;
    let maxDelay = 0;

    cells.forEach(idx => {
      const r = Math.floor(idx / 9), c = idx % 9;
      const dist = Math.abs(r - trigRow) + Math.abs(c - trigCol);
      const delay = dist * 65;
      maxDelay = Math.max(maxDelay, delay);

      const el = cellEls[idx];
      el.classList.remove('flashing');
      void el.offsetWidth; // force reflow to restart animation
      el.style.setProperty('--flash-delay', `${delay}ms`);
      el.classList.add('flashing');
      setTimeout(() => el.classList.remove('flashing'), delay + 580);
    });

    // Wait for this unit's animation to finish before starting the next
    setTimeout(drainAnimQueue, maxDelay + 620);
  }

  function triggerWinCascade(callback) {
    // Flush any queued unit animations first
    animQueue = [];
    animRunning = false;
    cellEls.forEach(el => {
      el.classList.remove('flashing');
      void el.offsetWidth;
    });

    cellEls.forEach((el, i) => {
      el.classList.remove('win-flash');
      void el.offsetWidth;
      el.style.setProperty('--flash-delay', `${i * 9}ms`);
      el.classList.add('win-flash');
    });

    setTimeout(callback, 81 * 9 + 750);
  }

  // ── Modals ────────────────────────────────────────────────────────────────────

  function showWinModal(state) {
    const newRecord = Game.isNewRecord();

    document.getElementById('win-diff').textContent = capitalize(state.difficulty);
    document.getElementById('win-time').textContent = Game.formatTime(state.elapsed);
    document.getElementById('win-record').classList.toggle('hidden', !newRecord);
    document.getElementById('win-mistakes').textContent =
      state.mistakes === 0 ? 'Perfect — no mistakes!' : `Mistakes made: ${state.mistakes}`;

    showModal('win-modal');
    refreshBestTimes();
    Game.clearProgress();
  }

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if (id === 'menu-screen') { refreshBestTimes(); checkResumeBanner(); }
  }

  function showModal(id)   { document.getElementById(id).classList.remove('hidden'); }
  function hideModal(id)   { document.getElementById(id).classList.add('hidden'); }

  // ── Menu Helpers ──────────────────────────────────────────────────────────────

  function refreshBestTimes() {
    ['easy', 'medium', 'hard', 'expert'].forEach(d => {
      const el = document.querySelector(`[data-best="${d}"]`);
      if (el) el.textContent = Game.getBestTime(d) || '--:--';
    });
  }

  function checkResumeBanner() {
    const saved = Game.loadProgress();
    document.getElementById('resume-banner').classList.toggle('hidden', !saved);
  }

  function capitalize(s) {
    return s ? s[0].toUpperCase() + s.slice(1) : '';
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => UI.init());
