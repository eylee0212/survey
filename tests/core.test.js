'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadCore } = require('./load-core');

const G = loadCore();
const N = G.SIZE;

// 수 목록 [[r, c], ...]을 차례로 둔다(흑부터 번갈아). 둘 수 없는 수가 있으면 실패.
function playAll(moves, start = G.createGame()) {
  let s = start;
  for (const [r, c] of moves) {
    const res = G.play(s, r, c);
    assert.ok(res.ok, `둘 수 없음: ${r},${c} (${res.reason})`);
    s = res.state;
  }
  return s;
}

// 흑·백 돌을 원하는 자리에 놓은 판(차례는 turn). 승리 판정은 하지 않는다.
function position(black, white, turn = 'B') {
  const s = G.createGame();
  for (const [r, c] of black) s.board[r * N + c] = 'B';
  for (const [r, c] of white) s.board[r * N + c] = 'W';
  s.turn = turn;
  return s;
}

test('판은 10×10, 3개를 이으면 이긴다', () => {
  assert.equal(G.SIZE, 10);
  assert.equal(G.WIN_LENGTH, 3);
  const s = G.createGame();
  assert.equal(s.board.length, 100);
  assert.ok(s.board.every(v => v === null));
  assert.equal(s.turn, 'B');
  assert.equal(s.winner, null);
});

test('흑부터 번갈아 둔다', () => {
  const s = playAll([[0, 0], [5, 5], [9, 9]]);
  assert.equal(s.board[0], 'B');
  assert.equal(s.board[55], 'W');
  assert.equal(s.board[99], 'B');
  assert.equal(s.turn, 'W');
  assert.deepEqual(s.moves.map(m => m.player), ['B', 'W', 'B']);
});

test('play는 원래 상태를 바꾸지 않는다', () => {
  const s0 = G.createGame();
  const res = G.play(s0, 3, 3);
  assert.ok(res.ok);
  assert.equal(s0.board[33], null);
  assert.equal(s0.moves.length, 0);
});

test('이미 돌이 있는 칸, 판 밖, 정수가 아닌 좌표에는 둘 수 없다', () => {
  const s = playAll([[2, 2]]);
  assert.equal(G.play(s, 2, 2).reason, 'occupied');
  for (const [r, c] of [[-1, 0], [0, -1], [10, 0], [0, 10], [1.5, 2], ['1', 2], [NaN, 0]]) {
    assert.equal(G.play(s, r, c).reason, 'outside', JSON.stringify([r, c]));
  }
});

test('가로 3개로 이긴다', () => {
  const s = playAll([[4, 3], [0, 0], [4, 4], [0, 9], [4, 5]]);
  assert.equal(s.winner, 'B');
  assert.deepEqual(s.winLine, [[4, 3], [4, 4], [4, 5]]);
});

test('세로 3개로 이긴다(백)', () => {
  const s = playAll([[0, 0], [7, 2], [0, 5], [8, 2], [9, 9], [9, 2]]);
  assert.equal(s.winner, 'W');
  assert.deepEqual(s.winLine, [[7, 2], [8, 2], [9, 2]]);
});

test('↘ 대각선 3개로 이긴다', () => {
  const s = playAll([[0, 0], [9, 0], [1, 1], [9, 1], [2, 2]]);
  assert.equal(s.winner, 'B');
  assert.deepEqual(s.winLine, [[0, 0], [1, 1], [2, 2]]);
});

test('↙ 대각선 3개로 이긴다(판 오른쪽 위 모서리)', () => {
  const s = playAll([[0, 9], [5, 5], [1, 8], [5, 6], [2, 7]]);
  assert.equal(s.winner, 'B');
  assert.deepEqual(s.winLine, [[0, 9], [1, 8], [2, 7]]);
});

test('가운데 칸을 마지막에 메워도 이긴다', () => {
  const s = playAll([[3, 3], [0, 0], [3, 5], [0, 9], [3, 4]]);
  assert.equal(s.winner, 'B');
  assert.deepEqual(s.winLine, [[3, 3], [3, 4], [3, 5]]);
});

test('4개 이상 이어져도 승리이고 줄 전체를 돌려준다', () => {
  const s = position([[6, 1], [6, 2], [6, 4], [6, 5]], []);
  const res = G.play(s, 6, 3);
  assert.equal(res.state.winner, 'B');
  assert.deepEqual(res.state.winLine, [[6, 1], [6, 2], [6, 3], [6, 4], [6, 5]]);
});

test('줄이 판 가장자리에서 끊기면 이어지지 않는다', () => {
  // (0,9) 다음 칸은 (1,0)이 아니다(1차원 배열로 넘어가지 않는지)
  const s = playAll([[0, 8], [5, 5], [0, 9], [5, 7], [1, 0]]);
  assert.equal(s.winner, null);
});

test('2개만으로는 이기지 않는다', () => {
  const s = playAll([[5, 5], [0, 0], [5, 6]]);
  assert.equal(s.winner, null);
  assert.deepEqual(s.winLine, []);
});

test('끝난 판에는 더 둘 수 없다', () => {
  const s = playAll([[4, 3], [0, 0], [4, 4], [0, 9], [4, 5]]);
  assert.equal(G.play(s, 9, 9).reason, 'over');
});

test('승자 없이 100칸이 차면 무승부', () => {
  // 짝수 행은 BBWW…, 홀수 행은 WWBB… 무늬. 어느 방향으로도 같은 색 3개가 이어지지 않는다.
  const color = (r, c) => (Math.floor((c + 2 * (r % 2)) / 2) % 2 === 0 ? 'B' : 'W');
  const blacks = [];
  const whites = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) (color(r, c) === 'B' ? blacks : whites).push([r, c]);
  assert.equal(blacks.length, 50);
  const moves = [];
  for (let i = 0; i < 50; i++) moves.push(blacks[i], whites[i]);
  const s = playAll(moves);
  assert.equal(s.moves.length, 100);
  assert.equal(s.winner, 'draw');
  assert.deepEqual(s.winLine, []);
});

test('무르기: 한 수, 여러 수, 처음보다 더 무르기', () => {
  const s = playAll([[1, 1], [2, 2], [3, 3]]);
  const u1 = G.undo(s);
  assert.equal(u1.moves.length, 2);
  assert.equal(u1.board[33], null);
  assert.equal(u1.turn, 'B');
  const u2 = G.undo(s, 2);
  assert.equal(u2.moves.length, 1);
  assert.equal(u2.turn, 'W');
  assert.deepEqual(G.undo(s, 5), G.createGame());
});

test('무르기는 승리도 되돌린다', () => {
  const s = playAll([[4, 3], [0, 0], [4, 4], [0, 9], [4, 5]]);
  const u = G.undo(s);
  assert.equal(u.winner, null);
  assert.deepEqual(u.winLine, []);
  assert.ok(G.play(u, 9, 9).ok);
});

test('컴퓨터: 빈 판에서는 가운데 근처에 둔다', () => {
  assert.deepEqual(G.chooseMove(G.createGame()), { row: 4, col: 4 });
});

test('컴퓨터: 이길 수 있으면 이긴다(막는 것보다 먼저)', () => {
  // 백 차례. 백은 (2,2)에 두면 이기고, 흑도 (7,5)에 두면 이기는 판.
  const s = position([[7, 3], [7, 4]], [[2, 0], [2, 1]], 'W');
  assert.deepEqual(G.chooseMove(s), { row: 2, col: 2 });
});

test('컴퓨터: 상대가 바로 이길 칸을 막는다', () => {
  const s = position([[5, 5], [6, 6]], [[0, 0]], 'W');
  const m = G.chooseMove(s);
  assert.ok([[4, 4], [7, 7]].some(([r, c]) => m.row === r && m.col === c), JSON.stringify(m));
});

test('컴퓨터: 이길 칸이 두 곳 생기는 수(양쪽 위협)를 찾는다', () => {
  // 흑 (5,5)만 있고 백 돌은 멀리. 흑이 붙여 두면 양 끝 두 칸이 이기는 칸이 된다.
  const s = position([[5, 5]], [[0, 0]], 'B');
  const m = G.chooseMove(s);
  const after = G.play(s, m.row, m.col).state;
  // 그 뒤 백이 어디를 막든 흑이 이긴다
  let wins = 0;
  for (let i = 0; i < 100; i++) {
    if (after.board[i]) continue;
    after.board[i] = 'B';
    const r = Math.floor(i / N);
    if (G.findWin(after.board, r, i % N).length) wins++;
    after.board[i] = null;
  }
  assert.ok(wins >= 2, `이기는 칸 ${wins}개`);
});

test('컴퓨터: 상대의 양쪽 위협 자리를 미리 막는다', () => {
  // 흑 (5,5)가 있고 백 차례. 백이 아무 데나 두면 흑이 양쪽 위협을 만든다.
  // 백은 흑이 위협을 만들 수 있는 칸 중 하나(흑 돌 옆)에 둬야 한다.
  const s = position([[5, 5]], [], 'W');
  const m = G.chooseMove(s);
  assert.ok(Math.abs(m.row - 5) <= 2 && Math.abs(m.col - 5) <= 2, JSON.stringify(m));
});

test('컴퓨터: 빈 칸에만 두고, 같은 판이면 같은 수를 고른다', () => {
  let s = G.createGame();
  for (let i = 0; i < 6 && !s.winner; i++) {
    const m = G.chooseMove(s);
    assert.deepEqual(G.chooseMove(s), m);
    assert.equal(s.board[m.row * N + m.col], null);
    s = G.play(s, m.row, m.col).state;
  }
});

test('컴퓨터: 끝난 판에서는 null', () => {
  const s = playAll([[4, 3], [0, 0], [4, 4], [0, 9], [4, 5]]);
  assert.equal(G.chooseMove(s), null);
});

test('컴퓨터끼리 두면 선수(흑)가 이긴다', () => {
  let s = G.createGame();
  while (!s.winner) {
    const m = G.chooseMove(s);
    s = G.play(s, m.row, m.col).state;
  }
  assert.equal(s.winner, 'B');
  assert.ok(s.moves.length <= 7, `${s.moves.length}수`);
});

test('컴퓨터: 거의 찬 판에서도 남은 빈 칸을 고른다', () => {
  const color = (r, c) => (Math.floor((c + 2 * (r % 2)) / 2) % 2 === 0 ? 'B' : 'W');
  const b = [];
  const w = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    if (r === 9 && c === 9) continue;
    (color(r, c) === 'B' ? b : w).push([r, c]);
  }
  const s = position(b, w, color(9, 9));
  assert.deepEqual(G.chooseMove(s), { row: 9, col: 9 });
});
