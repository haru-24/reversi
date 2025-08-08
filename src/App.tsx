import React, { useState, useCallback } from 'react';
import { Copy, Users, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { database, isFirebaseConfigured } from './firebase';
import { ref, set, update, onValue, off, get } from 'firebase/database';
import type { DataSnapshot, DatabaseReference } from 'firebase/database';

const BOARD_SIZE = 8;
const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;

// 型定義
type CellValue = typeof EMPTY | typeof BLACK | typeof WHITE;
type Board = CellValue[][];
type Position = [number, number];
type GamePhase = 'setup' | 'waiting' | 'playing' | 'finished';
type GameResult = 'black' | 'white' | 'draw' | null;
type PlayerColor = typeof BLACK | typeof WHITE;

interface GameState {
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

// ランダムなゲームIDを生成
const generateGameId = (): string => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

// ランダムなプレイヤーIDを生成
const generatePlayerId = (): string => {
  return Math.random().toString(36).substring(2, 12);
};

// 初期盤面を作成
const createInitialBoard = (): Board => {
  const board: Board = Array(BOARD_SIZE)
    .fill(null)
    .map(() => Array(BOARD_SIZE).fill(EMPTY));
  board[3][3] = WHITE;
  board[3][4] = BLACK;
  board[4][3] = BLACK;
  board[4][4] = WHITE;
  return board;
};

// 初期ゲーム状態を作成
const createInitialGameState = (hostPlayerId: string): GameState => ({
  board: createInitialBoard(),
  currentPlayer: BLACK,
  gamePhase: 'waiting',
  gameResult: null,
  players: {
    black: hostPlayerId,
  },
  createdAt: Date.now(),
});

// 方向ベクトル（8方向）
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

export const ReversiUI: React.FC = () => {
  const [board, setBoard] = useState<Board>(createInitialBoard());
  const [currentPlayer, setCurrentPlayer] = useState<PlayerColor>(BLACK);
  const [myColor, setMyColor] = useState<PlayerColor | null>(null);
  const [myPlayerId] = useState<string>(generatePlayerId());
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup');
  const [gameResult, setGameResult] = useState<GameResult>(null);
  const [gameId, setGameId] = useState<string>('');
  const [joinGameId, setJoinGameId] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [opponentConnected, setOpponentConnected] = useState<boolean>(false);
  const [gameStateRef, setGameStateRef] = useState<DatabaseReference | null>(
    null
  );

  // 有効な手を取得
  const getValidMoves = useCallback(
    (board: Board, player: PlayerColor): Position[] => {
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
    },
    []
  );

  // ひっくり返せる石の位置を取得
  const canFlip = (
    board: Board,
    row: number,
    col: number,
    player: PlayerColor
  ): Position[] => {
    const toFlip: Position[] = [];
    const opponent: PlayerColor = player === BLACK ? WHITE : BLACK;

    for (const [dr, dc] of DIRECTIONS) {
      const lineToFlip: Position[] = [];
      let r = row + dr;
      let c = col + dc;

      while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
        if (board[r][c] === EMPTY) break;
        if (board[r][c] === opponent) {
          lineToFlip.push([r, c]);
        } else if (board[r][c] === player) {
          toFlip.push(...lineToFlip);
          break;
        }
        r += dr;
        c += dc;
      }
    }
    return toFlip;
  };

  // 手を打つ（Firebase経由）
  const makeMove = async (
    row: number,
    col: number,
    player: PlayerColor
  ): Promise<boolean> => {
    if (!gameStateRef || gamePhase !== 'playing' || currentPlayer !== myColor)
      return false;

    const toFlip = canFlip(board, row, col, player);
    if (toFlip.length === 0) return false;

    const newBoard: Board = board.map(r => [...r]);
    newBoard[row][col] = player;
    toFlip.forEach(([r, c]) => {
      newBoard[r][c] = player;
    });

    // 次のプレイヤーを決定
    const nextPlayer: PlayerColor = player === BLACK ? WHITE : BLACK;
    const nextValidMoves = getValidMoves(newBoard, nextPlayer);

    let newGamePhase: GamePhase = 'playing';
    let newGameResult: GameResult = null;

    if (nextValidMoves.length === 0) {
      const currentValidMoves = getValidMoves(newBoard, player);
      if (currentValidMoves.length === 0) {
        // ゲーム終了
        const blackCount = newBoard
          .flat()
          .filter(cell => cell === BLACK).length;
        const whiteCount = newBoard
          .flat()
          .filter(cell => cell === WHITE).length;
        if (blackCount > whiteCount) newGameResult = 'black';
        else if (whiteCount > blackCount) newGameResult = 'white';
        else newGameResult = 'draw';
        newGamePhase = 'finished';
      }
    }

    // Firebaseを更新
    try {
      await update(gameStateRef, {
        board: newBoard,
        currentPlayer: nextValidMoves.length > 0 ? nextPlayer : player,
        gamePhase: newGamePhase,
        gameResult: newGameResult,
        lastMove: {
          row,
          col,
          player,
          timestamp: Date.now(),
        },
      });
      return true;
    } catch (error) {
      console.error('Failed to update game state:', error);
      return false;
    }
  };

  // ゲームを作成
  const createGame = async (): Promise<void> => {
    if (!isFirebaseConfigured) {
      alert('Firebase設定が必要です。設定を確認してください。');
      return;
    }

    const newGameId = generateGameId();
    const initialState = createInitialGameState(myPlayerId);
    const gameRef = ref(database, `games/${newGameId}`);

    try {
      await set(gameRef, initialState);
      setGameId(newGameId);
      setMyColor(BLACK);
      setGameStateRef(gameRef);
      setGamePhase('waiting');
      setIsConnected(true);

      // ゲーム状態の監視を開始
      onValue(gameRef, handleGameStateUpdate);
    } catch (error) {
      console.error('Failed to create game:', error);
      alert('ゲーム作成に失敗しました。');
    }
  };

  // ゲームに参加
  const joinGame = async (): Promise<void> => {
    if (!isFirebaseConfigured) {
      alert('Firebase設定が必要です。設定を確認してください。');
      return;
    }

    if (!joinGameId) return;

    const gameRef = ref(database, `games/${joinGameId}`);

    try {
      const snapshot = await get(gameRef);
      const gameState = snapshot.val();

      if (!snapshot.exists()) {
        alert('ゲームが見つかりません。ゲームIDを確認してください。');
        return;
      }

      if (gameState.players.white) {
        alert('このゲームは既に満員です。');
        return;
      }

      // 白プレイヤーとして参加
      await update(gameRef, {
        'players/white': myPlayerId,
        gamePhase: 'playing',
      });

      setGameId(joinGameId);
      setMyColor(WHITE);
      setGameStateRef(gameRef);
      setIsConnected(true);

      // ゲーム状態の監視を開始
      onValue(gameRef, handleGameStateUpdate);
    } catch (error) {
      console.error('Failed to join game:', error);
      alert('ゲーム参加に失敗しました。');
    }
  };

  // ゲーム状態の更新を処理
  const handleGameStateUpdate = useCallback(
    (snapshot: DataSnapshot) => {
      const gameState: GameState | null = snapshot.val();

      if (!gameState) return;

      setBoard(gameState.board);
      setCurrentPlayer(gameState.currentPlayer);
      setGamePhase(gameState.gamePhase);
      setGameResult(gameState.gameResult);

      // 相手の接続状態を確認
      const isOpponentConnected =
        myColor === BLACK
          ? !!gameState.players.white
          : !!gameState.players.black;
      setOpponentConnected(isOpponentConnected);
    },
    [myColor]
  );

  // セルクリック処理
  const handleCellClick = (row: number, col: number): void => {
    if (
      gamePhase !== 'playing' ||
      currentPlayer !== myColor ||
      board[row][col] !== EMPTY
    )
      return;
    makeMove(row, col, myColor!);
  };

  // 新しいゲームを開始
  const resetGame = (): void => {
    if (gameStateRef) {
      off(gameStateRef, 'value', handleGameStateUpdate);
    }

    setBoard(createInitialBoard());
    setCurrentPlayer(BLACK);
    setMyColor(null);
    setGamePhase('setup');
    setGameResult(null);
    setGameId('');
    setJoinGameId('');
    setGameStateRef(null);
    setIsConnected(false);
    setOpponentConnected(false);
  };

  // 石の数を数える
  const getStoneCount = (color: PlayerColor): number => {
    return board.flat().filter(cell => cell === color).length;
  };

  // クリップボードにコピー
  const copyToClipboard = async (text: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error('Failed to copy text:', error);
    }
  };

  // 有効な手を表示するかどうか
  const validMoves: Position[] =
    gamePhase === 'playing' && currentPlayer === myColor && myColor !== null
      ? getValidMoves(board, myColor)
      : [];

  const isValidMove = (row: number, col: number): boolean => {
    return validMoves.some(([r, c]) => r === row && c === col);
  };

  const getColorName = (color: PlayerColor): string => {
    return color === BLACK ? '黒' : '白';
  };

  const getResultMessage = (result: GameResult): string => {
    if (result === 'draw') return '引き分け！';
    if (result === 'black') return '黒の勝利！';
    if (result === 'white') return '白の勝利！';
    return '';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-green-900 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-white mb-2">リバーシ</h1>
          <div className="flex items-center justify-center gap-4 text-blue-200">
            <div className="flex items-center gap-2">
              {isConnected ? (
                <>
                  <Wifi className="w-5 h-5" />
                  <span>Firebase接続済み</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-5 h-5" />
                  <span>未接続</span>
                </>
              )}
            </div>
            {gamePhase === 'playing' && (
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                <span>
                  {opponentConnected
                    ? '対戦相手: オンライン'
                    : '対戦相手: 待機中'}
                </span>
              </div>
            )}
          </div>
        </div>

        {!isFirebaseConfigured && (
          <div className="bg-red-600/20 border border-red-500 rounded-xl p-4 mb-6">
            <h3 className="text-red-200 font-bold mb-2">
              Firebase設定が必要です
            </h3>
            <p className="text-red-200 text-sm">
              FIREBASE_CONFIGオブジェクトに実際のFirebase設定値を入力してください。
              <br />
              Firebase Console → プロジェクト設定 → SDK設定と構成
              から取得できます。
            </p>
          </div>
        )}

        {gamePhase === 'setup' && (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 mb-6">
            <h2 className="text-2xl font-bold text-white mb-4 text-center">
              ゲーム開始
            </h2>
            <div className="flex flex-col gap-4">
              <button
                onClick={createGame}
                disabled={!isFirebaseConfigured}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 text-white px-6 py-3 rounded-lg transition-colors font-medium"
              >
                新しいゲームを作成（黒石・先手）
              </button>
              <div className="border-t border-white/20 pt-4">
                <div className="mb-4">
                  <label className="block text-white mb-2">
                    ゲームIDを入力して参加：
                  </label>
                  <input
                    type="text"
                    value={joinGameId}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setJoinGameId(e.target.value.toUpperCase())
                    }
                    className="w-full p-3 rounded-lg bg-black/20 text-white placeholder-gray-300 border border-gray-600"
                    placeholder="例: ABC123"
                    maxLength={6}
                  />
                </div>
                <button
                  onClick={joinGame}
                  disabled={!joinGameId || !isFirebaseConfigured}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-500 text-white px-6 py-3 rounded-lg transition-colors font-medium"
                >
                  ゲームに参加する（白石・後手）
                </button>
              </div>
            </div>
          </div>
        )}

        {gamePhase === 'waiting' && (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 mb-6">
            <h2 className="text-2xl font-bold text-white mb-4 text-center">
              プレイヤーを待機中...
            </h2>
            <div className="text-center">
              <div className="mb-4">
                <label className="block text-white mb-2">
                  ゲームID（相手に共有してください）：
                </label>
                <div className="flex items-center justify-center gap-2">
                  <div className="bg-black/20 px-6 py-3 rounded-lg border border-gray-600">
                    <span className="text-white text-2xl font-mono font-bold">
                      {gameId}
                    </span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(gameId)}
                    className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg"
                  >
                    <Copy className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 text-blue-200">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>相手プレイヤーの参加を待っています...</span>
              </div>
            </div>
          </div>
        )}

        {(gamePhase === 'playing' || gamePhase === 'finished') && (
          <>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 mb-6">
              <div className="flex justify-between items-center text-white">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-black rounded-full border-2 border-white"></div>
                  <span>黒: {getStoneCount(BLACK)}</span>
                  {myColor === BLACK && (
                    <span className="text-yellow-300">（あなた）</span>
                  )}
                </div>

                <div className="text-center">
                  <div className="text-sm text-blue-200 mb-1">
                    ゲームID: {gameId}
                  </div>
                  {gamePhase === 'playing' && (
                    <div>
                      <div className="text-sm opacity-80">現在のターン</div>
                      <div className="flex items-center gap-2 justify-center">
                        <div
                          className={`w-4 h-4 rounded-full border ${
                            currentPlayer === BLACK
                              ? 'bg-black border-white'
                              : 'bg-white border-black'
                          }`}
                        ></div>
                        <span>{getColorName(currentPlayer)}</span>
                        {currentPlayer === myColor && (
                          <span className="text-yellow-300">
                            （あなたの番）
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  {gamePhase === 'finished' && (
                    <div className="text-xl font-bold">
                      {getResultMessage(gameResult)}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-white rounded-full border-2 border-black"></div>
                  <span>白: {getStoneCount(WHITE)}</span>
                  {myColor === WHITE && (
                    <span className="text-yellow-300">（あなた）</span>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-green-600 p-4 rounded-xl mb-6 shadow-2xl">
              <div className="grid grid-cols-8 gap-1">
                {board.map((row, rowIndex) =>
                  row.map((cell, colIndex) => (
                    <div
                      key={`${rowIndex}-${colIndex}`}
                      onClick={() => handleCellClick(rowIndex, colIndex)}
                      className={`
                        aspect-square bg-green-500 border border-green-700 flex items-center justify-center
                        cursor-pointer hover:bg-green-400 transition-colors relative
                        ${
                          gamePhase === 'playing' &&
                          currentPlayer === myColor &&
                          isValidMove(rowIndex, colIndex)
                            ? 'ring-2 ring-yellow-400 ring-opacity-60'
                            : ''
                        }
                      `}
                    >
                      {cell === BLACK && (
                        <div className="w-4/5 h-4/5 bg-black rounded-full border-2 border-gray-600 shadow-lg"></div>
                      )}
                      {cell === WHITE && (
                        <div className="w-4/5 h-4/5 bg-white rounded-full border-2 border-gray-300 shadow-lg"></div>
                      )}
                      {gamePhase === 'playing' &&
                        currentPlayer === myColor &&
                        myColor !== null &&
                        isValidMove(rowIndex, colIndex) && (
                          <div
                            className={`w-3/5 h-3/5 rounded-full border-2 border-dashed opacity-50 ${
                              myColor === BLACK
                                ? 'border-black'
                                : 'border-white'
                            }`}
                          ></div>
                        )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="text-center">
              <button
                onClick={resetGame}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg transition-colors font-medium"
              >
                新しいゲームを開始
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ReversiUI;
