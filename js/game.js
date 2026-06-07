const Game = (() => {
  let state = null;
  let moveStack = [];
  let timerInterval = null;
  let _onStateChange = null;
  let _lastDifficulty = null;

  // ── Init ────────────────────────────────────────────────────────────────────

  function init(difficulty, savedState = null) {
    clearInterval(timerInterval);
    moveStack = [];

    if (savedState) {
      state = savedState;
      state.notes = state.notes.map(n => new Set(n));
      _lastDifficulty = state.difficulty;
      if (!state.paused && state.timerStarted && !state.locked) {
        resumeTimer();
      }
      notify('init');
      return;
    }

    _lastDifficulty = difficulty;
    const { puzzle, solution } = SudokuGenerator.generatePuzzle(difficulty);

    state = {
      board: [...puzzle],
      solution: [...solution],
      given: puzzle.map(v => v !== 0),
      notes: Array.from({ length: 81 }, () => new Set()),
      selected: null,
      mode: 'normal',
      paused: false,
      timerStarted: false,
      elapsed: 0,
      difficulty,
      mistakes: 0,
      locked: false,
    };
    notify('init');
  }

  // ── Timer ───────────────────────────────────────────────────────────────────

  function resumeTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (state && !state.paused && !state.locked) {
        state.elapsed++;
        notify('tick');
      }
    }, 1000);
  }

  function ensureTimerStarted() {
    if (!state || state.timerStarted || state.paused || state.locked) return;
    state.timerStarted = true;
    resumeTimer();
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  function select(idx) {
    if (!state || state.locked || state.paused) return;
    state.selected = idx;
    ensureTimerStarted();
    notify('select');
  }

  function inputDigit(digit) {
    if (!state || state.locked || state.paused) return;
    const idx = state.selected;
    if (idx === null || state.given[idx]) return;
    ensureTimerStarted();

    if (state.mode === 'notes') {
      if (state.board[idx] !== 0) return;
      const prevNotes = new Set(state.notes[idx]);
      if (state.notes[idx].has(digit)) {
        state.notes[idx].delete(digit);
      } else {
        state.notes[idx].add(digit);
      }
      pushMove({ type: 'note', idx, prevNotes });
      notify('note');
      return;
    }

    if (state.board[idx] === digit) return; // no-op

    const prevVal = state.board[idx];
    const prevNotes = new Set(state.notes[idx]);
    const affectedNotes = {};
    getRelated(idx).forEach(i => { affectedNotes[i] = new Set(state.notes[i]); });

    state.board[idx] = digit;
    state.notes[idx].clear();
    getRelated(idx).forEach(i => state.notes[i].delete(digit));

    const isMistake = digit !== state.solution[idx];
    if (isMistake) state.mistakes++;

    pushMove({ type: 'place', idx, prevVal, prevNotes, affectedNotes, isMistake });

    if (state.mistakes >= 3) {
      state.locked = true;
      clearInterval(timerInterval);
      notify('fail');
      return;
    }

    if (isWon()) {
      state.locked = true;
      clearInterval(timerInterval);
      saveBestTime();
      notify('win');
      return;
    }

    notify('place');
  }

  function erase() {
    if (!state || state.locked || state.paused) return;
    const idx = state.selected;
    if (idx === null || state.given[idx]) return;
    if (state.board[idx] === 0 && state.notes[idx].size === 0) return;

    const prevVal = state.board[idx];
    const prevNotes = new Set(state.notes[idx]);
    pushMove({ type: 'erase', idx, prevVal, prevNotes });

    state.board[idx] = 0;
    state.notes[idx].clear();
    notify('erase');
  }

  function undo() {
    if (!state || state.locked || !moveStack.length) return;
    const move = moveStack.pop();

    if (move.type === 'note') {
      state.notes[move.idx] = move.prevNotes;
    } else if (move.type === 'place') {
      state.board[move.idx] = move.prevVal;
      state.notes[move.idx] = move.prevNotes;
      Object.entries(move.affectedNotes).forEach(([i, n]) => { state.notes[+i] = n; });
      if (move.isMistake) state.mistakes = Math.max(0, state.mistakes - 1);
    } else if (move.type === 'erase') {
      state.board[move.idx] = move.prevVal;
      state.notes[move.idx] = move.prevNotes;
    }

    notify('undo');
  }

  function togglePause() {
    if (!state || state.locked) return;
    state.paused = !state.paused;
    if (state.paused) {
      clearInterval(timerInterval);
    } else if (state.timerStarted) {
      resumeTimer();
    }
    notify('pause');
  }

  function toggleMode() {
    if (!state || state.locked || state.paused) return;
    state.mode = state.mode === 'normal' ? 'notes' : 'normal';
    notify('mode');
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function pushMove(move) {
    moveStack.push(move);
    if (moveStack.length > 200) moveStack.shift();
  }

  function getRelated(idx) {
    const row = Math.floor(idx / 9), col = idx % 9;
    const br = Math.floor(row / 3) * 3, bc = Math.floor(col / 3) * 3;
    const s = new Set();
    for (let c = 0; c < 9; c++) s.add(row * 9 + c);
    for (let r = 0; r < 9; r++) s.add(r * 9 + col);
    for (let r = br; r < br + 3; r++)
      for (let c = bc; c < bc + 3; c++) s.add(r * 9 + c);
    s.delete(idx);
    return [...s];
  }

  function isWon() {
    if (state.board.includes(0)) return false;
    for (let i = 0; i < 9; i++) {
      const rs = new Set(), cs = new Set(), bs = new Set();
      for (let j = 0; j < 9; j++) {
        rs.add(state.board[i * 9 + j]);
        cs.add(state.board[j * 9 + i]);
        bs.add(state.board[(Math.floor(i / 3) * 3 + Math.floor(j / 3)) * 9 + (i % 3) * 3 + j % 3]);
      }
      if (rs.size !== 9 || cs.size !== 9 || bs.size !== 9) return false;
    }
    return true;
  }

  // ── Queries ─────────────────────────────────────────────────────────────────

  function getConflicts() {
    if (!state) return new Set();
    const conflicts = new Set();
    for (let i = 0; i < 9; i++) {
      [
        Array.from({ length: 9 }, (_, j) => i * 9 + j),               // row
        Array.from({ length: 9 }, (_, j) => j * 9 + i),               // col
        Array.from({ length: 9 }, (_, j) =>                            // box
          (Math.floor(i / 3) * 3 + Math.floor(j / 3)) * 9 + (i % 3) * 3 + j % 3),
      ].forEach(cells => {
        const seen = {};
        cells.forEach(idx => {
          const v = state.board[idx];
          if (v === 0) return;
          if (seen[v] !== undefined) { conflicts.add(idx); conflicts.add(seen[v]); }
          else seen[v] = idx;
        });
      });
    }
    return conflicts;
  }

  function getCompletedUnits(lastIdx) {
    if (!state) return [];
    const row = Math.floor(lastIdx / 9), col = lastIdx % 9;
    const units = [
      Array.from({ length: 9 }, (_, j) => row * 9 + j),
      Array.from({ length: 9 }, (_, j) => j * 9 + col),
      (() => {
        const br = Math.floor(row / 3) * 3, bc = Math.floor(col / 3) * 3;
        return Array.from({ length: 9 }, (_, j) => (br + Math.floor(j / 3)) * 9 + bc + j % 3);
      })(),
    ];
    return units.filter(cells => {
      const vals = new Set(cells.map(i => state.board[i]));
      return vals.size === 9 && !vals.has(0);
    });
  }

  // ── Persistence ──────────────────────────────────────────────────────────────

  function saveProgress() {
    if (!state || state.locked) {
      localStorage.removeItem('sudoku-progress');
      return;
    }
    const snapshot = { ...state, notes: state.notes.map(n => [...n]) };
    localStorage.setItem('sudoku-progress', JSON.stringify(snapshot));
  }

  function loadProgress() {
    try {
      const raw = localStorage.getItem('sudoku-progress');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function clearProgress() {
    localStorage.removeItem('sudoku-progress');
  }

  function saveBestTime() {
    const key = `sudoku-best-${state.difficulty}`;
    const prev = parseInt(localStorage.getItem(key) || '999999', 10);
    if (state.elapsed < prev) localStorage.setItem(key, state.elapsed);
  }

  function isNewRecord() {
    const key = `sudoku-best-${state.difficulty}`;
    const prev = parseInt(localStorage.getItem(key) || '999999', 10);
    return state.elapsed <= prev;
  }

  function getBestTime(difficulty) {
    const t = parseInt(localStorage.getItem(`sudoku-best-${difficulty}`) || '0', 10);
    return t > 0 ? formatTime(t) : null;
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  // ── Notify ───────────────────────────────────────────────────────────────────

  function notify(event) {
    _onStateChange && _onStateChange(state, event);
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  return {
    init, select, inputDigit, erase, undo, togglePause, toggleMode,
    getConflicts, getCompletedUnits,
    saveProgress, loadProgress, clearProgress, getBestTime, isNewRecord,
    formatTime,
    getState() { return state; },
    get onStateChange() { return _onStateChange; },
    set onStateChange(fn) { _onStateChange = fn; },
    get lastDifficulty() { return _lastDifficulty; },
  };
})();
