// Board constants
export const BOARD_SIZE = 8 as const;
export const EMPTY = 0 as const;
export const BLACK = 1 as const;
export const WHITE = 2 as const;

// Types
export type CellValue = typeof EMPTY | typeof BLACK | typeof WHITE;
export type Board = CellValue[][];
export type Position = [number, number];
export type GamePhase = 'setup' | 'waiting' | 'playing' | 'finished';
export type GameResult = 'black' | 'white' | 'draw' | null;
export type PlayerColor = typeof BLACK | typeof WHITE;

export interface GameState {
  board: Board;
  currentPlayer: PlayerColor;
  gamePhase: GamePhase;
  gameResult: GameResult;
  players: {
    black?: string;
    white?: string;
  };
  createdAt: number;
  lastMove?: {
    row: number;
    col: number;
    player: PlayerColor;
    timestamp: number;
  };
}

// Directions (8-neighborhood)
const DIRECTIONS: Position[] = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

// Id utilities
export const generateGameId = (): string =>
  Math.random().toString(36).substring(2, 8).toUpperCase();

export const generatePlayerId = (): string =>
  Math.random().toString(36).substring(2, 12);

// Board helpers
export const createInitialBoard = (): Board => {
  const board: Board = Array(BOARD_SIZE)
    .fill(null)
    .map(() => Array(BOARD_SIZE).fill(EMPTY));
  board[3][3] = WHITE;
  board[3][4] = BLACK;
  board[4][3] = BLACK;
  board[4][4] = WHITE;
  return board;
};

export const createInitialGameState = (hostPlayerId: string): GameState => ({
  board: createInitialBoard(),
  currentPlayer: BLACK,
  gamePhase: 'waiting',
  gameResult: null,
  players: {
    black: hostPlayerId,
  },
  createdAt: Date.now(),
});

export const getOpponent = (player: PlayerColor): PlayerColor =>
  player === BLACK ? WHITE : BLACK;

export const canFlip = (
  board: Board,
  row: number,
  col: number,
  player: PlayerColor
): Position[] => {
  const toFlip: Position[] = [];
  const opponent: PlayerColor = getOpponent(player);

  for (const [dr, dc] of DIRECTIONS) {
    const lineToFlip: Position[] = [];
    let r = row + dr;
    let c = col + dc;

    while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
      if (board[r][c] === EMPTY) break;
      if (board[r][c] === opponent) {
        lineToFlip.push([r, c]);
      } else if (board[r][c] === player) {
        if (lineToFlip.length > 0) {
          toFlip.push(...lineToFlip);
        }
        break;
      }
      r += dr;
      c += dc;
    }
  }
  return toFlip;
};

export const getValidMoves = (
  board: Board,
  player: PlayerColor
): Position[] => {
  const validMoves: Position[] = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (board[row][col] === EMPTY) {
        if (canFlip(board, row, col, player).length > 0) {
          validMoves.push([row, col]);
        }
      }
    }
  }
  return validMoves;
};

export const getStoneCount = (board: Board, color: PlayerColor): number =>
  board.flat().filter(cell => cell === color).length;

export const getColorName = (color: PlayerColor): string =>
  color === BLACK ? '黒' : '白';

export const getResultMessage = (result: GameResult): string => {
  if (result === 'draw') return '引き分け！';
  if (result === 'black') return '黒の勝利！';
  if (result === 'white') return '白の勝利！';
  return '';
};
