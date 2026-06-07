# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the game

Open `index.html` directly in a browser — no build step, no server, no dependencies. All assets are local except the Nunito font (Google Fonts CDN).

## Git workflow

Every meaningful change must be committed and pushed to `https://github.com/Henwo00/sudoku`.

```bash
git add <specific files>
git commit -m "type: short description"
git push
```

Commit prefixes: `feat:` new feature · `fix:` bug fix · `style:` CSS/visual · `refactor:` restructure without behavior change.

## Architecture

Three IIFE modules are loaded in order via `<script>` tags in `index.html`. Each exposes a single global:

**`SudokuGenerator`** (`js/generator.js`) — pure puzzle logic, no DOM.
- `generatePuzzle(difficulty)` → `{ puzzle, solution }` (both flat `number[81]`, 0 = empty)
- Generates a valid complete board by shuffling a seed (digit relabeling + row/col/band/stack permutations + optional transpose), then removes cells one-by-one, keeping only removals that preserve a unique solution. Uniqueness is verified by a backtracking solver with MRV (minimum remaining values) heuristic that stops at 2 solutions.
- Givens per difficulty: `easy=46, medium=36, hard=29, expert=24`

**`Game`** (`js/game.js`) — all game state, zero DOM access.
- Holds a single `state` object: `board[81]`, `solution[81]`, `given[81]` (booleans), `notes[81]` (Sets), `selected`, `mode` ('normal'|'notes'), `paused`, `timerStarted`, `elapsed`, `difficulty`, `mistakes`, `locked`.
- Every mutating action (`inputDigit`, `erase`, `undo`, `select`, `togglePause`, `toggleMode`) ends with `notify(eventName)`, which calls `Game.onStateChange(state, event)`. UI sets this callback in `UI.init()`.
- Move stack stores `{ type, idx, prevVal, prevNotes, affectedNotes?, isMistake? }` — undo pops and reverses the recorded change including note side-effects.
- `localStorage` keys: `sudoku-progress` (full in-progress state, notes serialized as arrays), `sudoku-best-{difficulty}` (elapsed seconds as integer).
- `saveProgress()` is a no-op (clears storage) when `state.locked` — completed and failed games are never persisted.

**`UI`** (`js/ui.js`) — DOM rendering and event wiring, delegates all logic to `Game`.
- `render(state, event)` is the single re-render path, called on every `onStateChange`. It does a full pass over all 81 `cellEls`, recomputing CSS classes from scratch each call (no diffing).
- Cell highlighting priority order in `render`: `selected` > `same-digit` (same value as selected cell) > `related` (same row/col/box) > default.
- Completion animations use a serial queue (`animQueue`). When a digit placement completes one or more units, each unit's cell array is pushed onto the queue. `drainAnimQueue` fires them one at a time, using Manhattan distance from the trigger cell to stagger `--flash-delay` per cell. Win cascade bypasses the queue and flushes it first.
- Two `requestAnimationFrame` calls wrap `Game.init()` so the "Generating…" spinner is guaranteed to paint before the synchronous generation blocks the thread.
- Box borders are applied via CSS attribute selectors on `data-row` and `data-col` (set during `buildBoard`) rather than nth-child — this is intentional; don't change to nth-child.

## Cell indexing

All positions use a single flat index `0–80` where `idx = row * 9 + col`. Row/col are derived as `row = Math.floor(idx / 9)`, `col = idx % 9`. The box formula used throughout is:
```
boxRow = Math.floor(row / 3) * 3
boxCol = Math.floor(col / 3) * 3
cellInBox: (boxRow + Math.floor(j / 3)) * 9 + boxCol + j % 3   (j = 0..8)
```

## localStorage keys

| Key | Value |
|-----|-------|
| `sudoku-progress` | JSON snapshot of full `state` (notes as `number[][]`) |
| `sudoku-best-easy` | Integer (seconds) |
| `sudoku-best-medium` | Integer (seconds) |
| `sudoku-best-hard` | Integer (seconds) |
| `sudoku-best-expert` | Integer (seconds) |
