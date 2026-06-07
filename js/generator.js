const SudokuGenerator = (() => {
  // Valid seed board used as the starting point for shuffling
  const SEED = [
    5,3,4,6,7,8,9,1,2,
    6,7,2,1,9,5,3,4,8,
    1,9,8,3,4,2,5,6,7,
    8,5,9,7,6,1,4,2,3,
    4,2,6,8,5,3,7,9,1,
    7,1,3,9,2,4,8,5,6,
    9,6,1,5,3,7,2,8,4,
    2,8,7,4,1,9,6,3,5,
    3,4,5,2,8,6,1,7,9,
  ];

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function generateComplete() {
    let board = [...SEED];

    // Relabel all digits with a random permutation
    const map = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    board = board.map(v => map[v - 1]);

    // Permute rows within each band (keeps Sudoku validity)
    for (let band = 0; band < 3; band++) {
      const perm = shuffle([0, 1, 2]);
      const nb = [...board];
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 9; c++)
          nb[(band * 3 + r) * 9 + c] = board[(band * 3 + perm[r]) * 9 + c];
      board = nb;
    }

    // Permute columns within each stack
    for (let stack = 0; stack < 3; stack++) {
      const perm = shuffle([0, 1, 2]);
      const nb = [...board];
      for (let r = 0; r < 9; r++)
        for (let c = 0; c < 3; c++)
          nb[r * 9 + stack * 3 + c] = board[r * 9 + stack * 3 + perm[c]];
      board = nb;
    }

    // Permute whole bands
    const bandPerm = shuffle([0, 1, 2]);
    const nb1 = [...board];
    for (let b = 0; b < 3; b++)
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 9; c++)
          nb1[(b * 3 + r) * 9 + c] = board[(bandPerm[b] * 3 + r) * 9 + c];
    board = nb1;

    // Permute whole stacks
    const stackPerm = shuffle([0, 1, 2]);
    const nb2 = [...board];
    for (let s = 0; s < 3; s++)
      for (let r = 0; r < 9; r++)
        for (let c = 0; c < 3; c++)
          nb2[r * 9 + s * 3 + c] = board[r * 9 + stackPerm[s] * 3 + c];
    board = nb2;

    // Random transpose
    if (Math.random() < 0.5) {
      const nb = [...board];
      for (let r = 0; r < 9; r++)
        for (let c = 0; c < 9; c++)
          nb[r * 9 + c] = board[c * 9 + r];
      board = nb;
    }

    return board;
  }

  // Backtracking solver with MRV heuristic; stops after `limit` solutions found
  function countSolutions(board, limit = 2) {
    const b = [...board];
    let count = 0;

    function candidates(idx) {
      const row = Math.floor(idx / 9);
      const col = idx % 9;
      const used = new Set();
      for (let c = 0; c < 9; c++) used.add(b[row * 9 + c]);
      for (let r = 0; r < 9; r++) used.add(b[r * 9 + col]);
      const br = Math.floor(row / 3) * 3;
      const bc = Math.floor(col / 3) * 3;
      for (let r = br; r < br + 3; r++)
        for (let c = bc; c < bc + 3; c++)
          used.add(b[r * 9 + c]);
      return [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(d => !used.has(d));
    }

    function solve() {
      // Pick the empty cell with fewest candidates (MRV)
      let minLen = 10, minIdx = -1;
      for (let i = 0; i < 81; i++) {
        if (b[i] !== 0) continue;
        const c = candidates(i);
        if (c.length === 0) return; // dead end
        if (c.length < minLen) {
          minLen = c.length;
          minIdx = i;
          if (minLen === 1) break;
        }
      }
      if (minIdx === -1) { count++; return; } // all filled

      for (const d of candidates(minIdx)) {
        b[minIdx] = d;
        solve();
        if (count >= limit) return;
        b[minIdx] = 0;
      }
    }

    solve();
    return count;
  }

  const GIVENS = { easy: 46, medium: 36, hard: 29, expert: 24 };

  function generatePuzzle(difficulty) {
    const solution = generateComplete();
    const puzzle = [...solution];
    const toRemove = 81 - GIVENS[difficulty];
    const indices = shuffle([...Array(81).keys()]);
    let removed = 0;

    for (const idx of indices) {
      if (removed >= toRemove) break;
      const saved = puzzle[idx];
      puzzle[idx] = 0;
      if (countSolutions(puzzle) === 1) {
        removed++;
      } else {
        puzzle[idx] = saved;
      }
    }

    return { puzzle, solution };
  }

  return { generatePuzzle };
})();
