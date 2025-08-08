import React, { useState, useCallback } from 'react';
import { Copy, Wifi, WifiOff } from 'lucide-react';
import QRCode from 'react-qr-code';

const BOARD_SIZE = 8;
const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;

// 型定義
type CellValue = typeof EMPTY | typeof BLACK | typeof WHITE;
type Board = CellValue[][];
type Position = [number, number];
type GamePhase = 'setup' | 'waiting' | 'responding' | 'playing' | 'finished';
type GameResult = 'black' | 'white' | 'draw' | null;
type PlayerColor = typeof BLACK | typeof WHITE;

// ゲーム状態をエンコード/デコードする関数
const encodeGameState = (board: Board, currentPlayer: PlayerColor, gamePhase: GamePhase): string => {
  const gameState = {
    board: board,
    currentPlayer: currentPlayer,
    gamePhase: gamePhase,
    timestamp: Date.now()
  };
  const jsonString = JSON.stringify(gameState);
  return btoa(unescape(encodeURIComponent(jsonString))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
};

const decodeGameState = (encoded: string): { board: Board; currentPlayer: PlayerColor; gamePhase: GamePhase; timestamp: number } => {
  try {
    const padding = '='.repeat((4 - encoded.length % 4) % 4);
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/') + padding;
    const jsonString = decodeURIComponent(escape(atob(base64)));
    return JSON.parse(jsonString);
  } catch {
    throw new Error('無効なゲーム状態です');
  }
};

// ランダムな接続IDを生成
const generateConnectionId = (): string => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

// 初期盤面を作成
const createInitialBoard = (): Board => {
  const board: Board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(EMPTY));
  board[3][3] = WHITE;
  board[3][4] = BLACK;
  board[4][3] = BLACK;
  board[4][4] = WHITE;
  return board;
};

// 方向ベクトル（8方向）
const DIRECTIONS: Position[] = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1]
];

const P2PReversi: React.FC = () => {
  const [board, setBoard] = useState<Board>(createInitialBoard());
  const [currentPlayer, setCurrentPlayer] = useState<PlayerColor>(BLACK);
  const [myColor, setMyColor] = useState<PlayerColor | null>(null);
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [gameResult, setGameResult] = useState<GameResult>(null);
  const [connectionId, setConnectionId] = useState<string>('');
  const [inviteCode, setInviteCode] = useState<string>('');
  const [joinCode, setJoinCode] = useState<string>('');
  const [responseCode, setResponseCode] = useState<string>('');
  const [gameSyncCode, setGameSyncCode] = useState<string>('');
  const [opponentSyncCode, setOpponentSyncCode] = useState<string>('');
  const [showSyncDialog, setShowSyncDialog] = useState<boolean>(false);

  // 有効な手を取得
  const getValidMoves = useCallback((board: Board, player: PlayerColor): Position[] => {
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
  }, []);

  // ひっくり返せる石の位置を取得
  const canFlip = (board: Board, row: number, col: number, player: PlayerColor): Position[] => {
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

  // 手を打つ
  const makeMove = useCallback((row: number, col: number, player: PlayerColor): boolean => {
    const toFlip = canFlip(board, row, col, player);
    if (toFlip.length === 0) return false;

    const newBoard: Board = board.map(r => [...r]);
    newBoard[row][col] = player;
    toFlip.forEach(([r, c]) => {
      newBoard[r][c] = player;
    });

    setBoard(newBoard);
    
    // 次のプレイヤーに交代
    const nextPlayer: PlayerColor = player === BLACK ? WHITE : BLACK;
    const nextValidMoves = getValidMoves(newBoard, nextPlayer);
    
    if (nextValidMoves.length === 0) {
      const currentValidMoves = getValidMoves(newBoard, player);
      if (currentValidMoves.length === 0) {
        // ゲーム終了
        const blackCount = newBoard.flat().filter(cell => cell === BLACK).length;
        const whiteCount = newBoard.flat().filter(cell => cell === WHITE).length;
        let result: GameResult;
        if (blackCount > whiteCount) result = 'black';
        else if (whiteCount > blackCount) result = 'white';
        else result = 'draw';
        
        setGameResult(result);
        setGamePhase('finished');
      }
      // パスは発生しない（currentPlayerは変更しない）
    } else {
      setCurrentPlayer(nextPlayer);
    }

    return true;
  }, [board, getValidMoves]);

  // ゲームホストとして開始
  const startAsHost = async (): Promise<void> => {
    const id = generateConnectionId();
    setConnectionId(id);
    setMyColor(BLACK);
    setGamePhase('waiting');
    setIsConnected(true);
    
    // 初期状態をエンコード
    const gameState = encodeGameState(board, currentPlayer, 'waiting');
    const code = `${id}-${gameState}`;
    setInviteCode(code);
  };

  // ゲストとして参加
  const joinAsGuest = useCallback(async (): Promise<void> => {
    if (!joinCode) return;

    const parts = joinCode.split('-');
    if (parts.length < 2) {
      alert('無効な招待コードです。正しい形式: ID-XXXXXX');
      return;
    }

    const [id, ...encodedParts] = parts;
    const encodedGameState = encodedParts.join('-');

    try {
      const gameState = decodeGameState(encodedGameState);
      
      // ゲーム状態を復元
      setBoard(gameState.board);
      setCurrentPlayer(gameState.currentPlayer);
      setMyColor(WHITE);
      setIsConnected(true);
      
      // 応答コードを生成
      const responseState = encodeGameState(gameState.board, gameState.currentPlayer, 'responding');
      const responseCode = `${id}-${responseState}`;
      setResponseCode(responseCode);
      
      console.log('Guest joined successfully, waiting for host to receive response...');
      
      // 応答コード確認画面に遷移
      setGamePhase('responding');
    } catch (error) {
      console.error('Error joining game:', error);
      alert('招待コードの処理中にエラーが発生しました。コードを確認してください。');
    }
  }, [joinCode]);

  // ホストが回答を受信
  const receiveAnswer = async (): Promise<void> => {
    if (!responseCode || !connectionId) {
      alert('応答コードまたは接続IDが利用できません。');
      return;
    }

    const parts = responseCode.split('-');
    if (parts.length < 2) {
      alert('無効な応答コードです。正しい形式: ID-XXXXXX');
      return;
    }

    const [id, ...encodedParts] = parts;
    const encodedResponseState = encodedParts.join('-');

    if (id !== connectionId) {
      alert('接続IDが一致しません。正しい応答コードを入力してください。');
      return;
    }

    try {
      const responseState = decodeGameState(encodedResponseState);
      
      // ゲーム状態を更新
      setBoard(responseState.board);
      setCurrentPlayer(responseState.currentPlayer);
      setGamePhase('playing');
      
      console.log('Host received response, starting game...');
      alert('接続が完了しました！ゲームを開始します。ゲスト側にもゲーム開始を伝えてください。');
    } catch (error) {
      console.error('Error processing response:', error);
      alert('応答コードの処理中にエラーが発生しました。');
    }
  };

  // セルクリック処理
  const handleCellClick = (row: number, col: number): void => {
    if (gamePhase !== 'playing' || currentPlayer !== myColor || board[row][col] !== EMPTY) return;
    
    const toFlip = canFlip(board, row, col, myColor);
    if (toFlip.length === 0) return;

    if (makeMove(row, col, myColor)) {
      // 手を打った後、新しいゲーム状態をエンコードして相手に送信
      setTimeout(() => {
        const newGameState = encodeGameState(board, currentPlayer, 'playing');
        const syncCode = `${connectionId}-${newGameState}`;
        setGameSyncCode(syncCode);
        setShowSyncDialog(true);
      }, 100); // stateの更新を待つ
    }
  };

  // 相手からの同期コードを受信
  const receiveSyncCode = async (): Promise<void> => {
    if (!opponentSyncCode) {
      alert('同期コードが入力されていません。');
      return;
    }

    const parts = opponentSyncCode.split('-');
    if (parts.length < 2) {
      alert('無効な同期コードです。正しい形式: ID-XXXXXX');
      return;
    }

    const [id, ...encodedParts] = parts;
    const encodedGameState = encodedParts.join('-');

    if (id !== connectionId) {
      alert('接続IDが一致しません。正しい同期コードを入力してください。');
      return;
    }

    try {
      const gameState = decodeGameState(encodedGameState);
      
      // ゲーム状態を更新
      setBoard(gameState.board);
      setCurrentPlayer(gameState.currentPlayer);
      
      // 同期コードをクリア
      setOpponentSyncCode('');
      
      console.log('Game state synchronized successfully');
      alert('ゲーム状態が同期されました！');
    } catch (error) {
      console.error('Error synchronizing game state:', error);
      alert('同期コードの処理中にエラーが発生しました。');
    }
  };

  // 新しいゲームを開始
  const resetGame = (): void => {
    setBoard(createInitialBoard());
    setCurrentPlayer(BLACK);
    setMyColor(null);
    setGamePhase('setup');
    setGameResult(null);
    setConnectionId('');
    setInviteCode('');
    setJoinCode('');
    setResponseCode('');
    setGameSyncCode('');
    setOpponentSyncCode('');
    setShowSyncDialog(false);
    setIsConnected(false);
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
  const validMoves: Position[] = gamePhase === 'playing' && currentPlayer === myColor && myColor !== null ? 
    getValidMoves(board, myColor) : [];

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
          <h1 className="text-4xl font-bold text-white mb-2">リバーシ（QRコード方式）</h1>
          <div className="flex items-center justify-center gap-2 text-green-200">
            {isConnected ? (
              <>
                <Wifi className="w-5 h-5" />
                <span>接続済み</span>
              </>
            ) : (
              <>
                <WifiOff className="w-5 h-5" />
                <span>未接続</span>
              </>
            )}
          </div>
        </div>

        {gamePhase === 'setup' && (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 mb-6">
            <h2 className="text-2xl font-bold text-white mb-4 text-center">ゲーム開始</h2>
            <div className="flex flex-col gap-4">
              <button
                onClick={startAsHost}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors font-medium"
              >
                ゲームを作成する（黒石・先手）
              </button>
              <div className="border-t border-white/20 pt-4">
                <div className="mb-4">
                  <label className="block text-white mb-2">招待コードを入力：</label>
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setJoinCode(e.target.value)}
                    className="w-full p-3 rounded-lg bg-black/20 text-white placeholder-gray-300 border border-gray-600"
                    placeholder="例: ABC123-eyJ0eXBlIjoib2ZmZXIi..."
                  />
                  <p className="text-sm text-gray-300 mt-2">形式: 接続ID-ゲーム状態データ</p>
                </div>
                <button
                  onClick={joinAsGuest}
                  disabled={!joinCode}
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
            <h2 className="text-2xl font-bold text-white mb-4 text-center">プレイヤーを待機中...</h2>
            <div className="mb-4">
              <label className="block text-white mb-2">招待コード（相手に送信してください）：</label>
              <div className="relative">
                <input
                  type="text"
                  value={inviteCode}
                  readOnly
                  className="w-full p-3 rounded-lg bg-black/20 text-white border border-gray-600 pr-12"
                />
                <button
                  onClick={() => copyToClipboard(inviteCode)}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-gray-300 mt-2">接続ID: {connectionId}</p>
            </div>
            
            {/* QRコードを表示 */}
            <div className="flex justify-center mt-4">
              <div className="bg-white p-4 rounded-lg">
                <QRCode value={inviteCode} size={200} />
              </div>
            </div>
            
            <div className="border-t border-white/20 pt-4">
              <div className="mb-4">
                <label className="block text-white mb-2">応答コードを入力：</label>
                <input
                  type="text"
                  value={responseCode}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setResponseCode(e.target.value)}
                  className="w-full p-3 rounded-lg bg-black/20 text-white placeholder-gray-300 border border-gray-600"
                  placeholder={`${connectionId}-応答データ`}
                />
              </div>
              <button
                onClick={receiveAnswer}
                disabled={!responseCode}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-500 text-white px-6 py-3 rounded-lg transition-colors font-medium"
              >
                接続を完了する
              </button>
            </div>
          </div>
        )}

        {gamePhase === 'responding' && (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 mb-6">
            <h2 className="text-2xl font-bold text-white mb-4 text-center">応答コードを送信</h2>
            <div className="mb-4">
              <label className="block text-white mb-2">この応答コードをホストに送信してください：</label>
              <div className="relative">
                <input
                  type="text"
                  value={responseCode}
                  readOnly
                  className="w-full p-3 rounded-lg bg-black/20 text-white border border-gray-600 pr-12"
                />
                <button
                  onClick={() => copyToClipboard(responseCode)}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-gray-300 mt-2">ホストが応答コードを受信すると、ゲームが開始されます。</p>
            </div>
            
            {/* QRコードを表示 */}
            <div className="flex justify-center mt-4">
              <div className="bg-white p-4 rounded-lg">
                <QRCode value={responseCode} size={200} />
              </div>
            </div>
            
            {/* ゲスト側が手動でゲームを開始するボタンを追加 */}
            <div className="mt-4 text-center">
              <button
                onClick={() => setGamePhase('playing')}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition-colors font-medium"
              >
                ゲームを開始する
              </button>
              <p className="text-sm text-gray-300 mt-2">応答コードを送信した後、このボタンを押してゲームを開始してください。</p>
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
                </div>
                
                <div className="text-center">
                  {gamePhase === 'playing' && (
                    <div>
                      <div className="text-sm opacity-80">現在のターン</div>
                      <div className="flex items-center gap-2 justify-center">
                        <div className={`w-4 h-4 rounded-full border ${
                          currentPlayer === BLACK ? 'bg-black border-white' : 'bg-white border-black'
                        }`}></div>
                        <span>{getColorName(currentPlayer)}</span>
                        {currentPlayer === myColor && <span className="text-yellow-300">（あなた）</span>}
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
                        ${gamePhase === 'playing' && currentPlayer === myColor && isValidMove(rowIndex, colIndex) 
                          ? 'ring-2 ring-yellow-400 ring-opacity-60' : ''}
                      `}
                    >
                      {cell === BLACK && (
                        <div className="w-4/5 h-4/5 bg-black rounded-full border-2 border-gray-600 shadow-lg"></div>
                      )}
                      {cell === WHITE && (
                        <div className="w-4/5 h-4/5 bg-white rounded-full border-2 border-gray-300 shadow-lg"></div>
                      )}
                      {gamePhase === 'playing' && currentPlayer === myColor && myColor !== null && isValidMove(rowIndex, colIndex) && (
                        <div className={`w-3/5 h-3/5 rounded-full border-2 border-dashed opacity-50 ${
                          myColor === BLACK ? 'border-black' : 'border-white'
                        }`}></div>
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
            
            {/* 相手の手を受信するエリア */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 mt-6">
              <h3 className="text-xl font-bold text-white mb-4 text-center">相手の手を受信</h3>
              <div className="mb-4">
                <label className="block text-white mb-2">相手からの同期コードを入力：</label>
                <input
                  type="text"
                  value={opponentSyncCode}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOpponentSyncCode(e.target.value)}
                  className="w-full p-3 rounded-lg bg-black/20 text-white placeholder-gray-300 border border-gray-600"
                  placeholder={`${connectionId}-ゲーム状態データ`}
                />
              </div>
              <button
                onClick={receiveSyncCode}
                disabled={!opponentSyncCode}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 text-white px-6 py-3 rounded-lg transition-colors font-medium w-full"
              >
                ゲーム状態を同期
              </button>
            </div>
          </>
        )}
        
        {/* 同期コード送信ダイアログ */}
        {showSyncDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full">
              <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">手を相手に送信</h3>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">この同期コードを相手に送信してください：</label>
                <div className="relative">
                  <input
                    type="text"
                    value={gameSyncCode}
                    readOnly
                    className="w-full p-3 rounded-lg bg-gray-100 text-gray-800 border border-gray-300 pr-12"
                  />
                  <button
                    onClick={() => copyToClipboard(gameSyncCode)}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              {/* QRコードを表示 */}
              <div className="flex justify-center mb-4">
                <div className="bg-white p-2 rounded-lg border">
                  <QRCode value={gameSyncCode} size={150} />
                </div>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setShowSyncDialog(false)}
                  className="flex-1 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  閉じる
                </button>
                <button
                  onClick={() => {
                    copyToClipboard(gameSyncCode);
                    setShowSyncDialog(false);
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  コピーして閉じる
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default P2PReversi;