import React, { useState, useCallback } from 'react';
import {
  Button,
  Card,
  Input,
  Typography,
  Space,
  Row,
  Col,
  Divider,
  Alert,
  Spin,
  Badge,
  message,
  Layout,
  Avatar,
} from 'antd';
import {
  CopyOutlined,
  UserOutlined,
  WifiOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { database, isFirebaseConfigured } from './firebase';
import { ref, set, update, onValue, off, get } from 'firebase/database';
import type { DataSnapshot, DatabaseReference } from 'firebase/database';

const { Title, Text } = Typography;
const { Content } = Layout;

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
      message.error('Firebase設定が必要です。設定を確認してください。');
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
      message.error('ゲーム作成に失敗しました。');
    }
  };

  // ゲームに参加
  const joinGame = async (): Promise<void> => {
    if (!isFirebaseConfigured) {
      message.error('Firebase設定が必要です。設定を確認してください。');
      return;
    }

    if (!joinGameId) return;

    const gameRef = ref(database, `games/${joinGameId}`);

    try {
      const snapshot = await get(gameRef);
      const gameState = snapshot.val();

      if (!snapshot.exists()) {
        message.error('ゲームが見つかりません。ゲームIDを確認してください。');
        return;
      }

      if (gameState.players.white) {
        message.error('このゲームは既に満員です。');
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
      message.error('ゲーム参加に失敗しました。');
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
      message.success('ゲームIDをコピーしました');
    } catch (error) {
      console.error('Failed to copy text:', error);
      message.error('コピーに失敗しました');
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
    <Layout style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1b5e20 0%, #2e7d32 50%, #1b5e20 100%)' }}>
      <Content style={{ maxWidth: '1200px', margin: '0 auto', padding: '16px' }}>
          <Space direction="vertical" style={{ textAlign: 'center', marginBottom: '24px', width: '100%' }}>
            <Title level={1} style={{ color: 'white', marginBottom: '8px' }}>
              リバーシ
            </Title>
            <Space size="large">
              <Space>
                {isConnected ? (
                  <>
                    <WifiOutlined style={{ color: '#52c41a' }} />
                    <Text style={{ color: '#e6f7ff' }}>接続済み</Text>
                  </>
                ) : (
                  <>
                    <WifiOutlined style={{ color: '#ff4d4f', transform: 'rotate(45deg)' }} />
                    <Text style={{ color: '#e6f7ff' }}>未接続</Text>
                  </>
                )}
              </Space>
              {gamePhase === 'playing' && (
                <Space>
                  <UserOutlined style={{ color: '#1890ff' }} />
                  <Text style={{ color: '#e6f7ff' }}>
                    {opponentConnected ? '対戦相手: オンライン' : '対戦相手: 待機中'}
                  </Text>
                </Space>
              )}
            </Space>
          </Space>

          {!isFirebaseConfigured && (
            <Alert
              message="Firebase設定が必要です"
              description="FIREBASE_CONFIGオブジェクトに実際のFirebase設定値を入力してください。Firebase Console → プロジェクト設定 → SDK設定と構成 から取得できます。"
              type="error"
              showIcon
              style={{ marginBottom: '24px' }}
            />
          )}

          {gamePhase === 'setup' && (
            <Card style={{ marginBottom: '24px', background: 'rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(10px)' }}>
              <Title level={2} style={{ textAlign: 'center', color: 'white', marginBottom: '16px' }}>
                ゲーム開始
              </Title>
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Button
                  type="primary"
                  size="large"
                  onClick={createGame}
                  disabled={!isFirebaseConfigured}
                  style={{ width: '100%' }}
                >
                  新しいゲームを作成（黒石・先手）
                </Button>
                <Divider style={{ borderColor: 'rgba(255, 255, 255, 0.2)' }} />
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Text style={{ color: 'white' }}>ゲームIDを入力して参加：</Text>
                  <Input
                    value={joinGameId}
                    onChange={(e) => setJoinGameId(e.target.value.toUpperCase())}
                    placeholder="例: ABC123"
                    maxLength={6}
                    size="large"
                  />
                  <Button
                    type="primary"
                    size="large"
                    onClick={joinGame}
                    disabled={!joinGameId || !isFirebaseConfigured}
                    style={{ width: '100%' }}
                  >
                    ゲームに参加する（白石・後手）
                  </Button>
                </Space>
              </Space>
            </Card>
          )}

          {gamePhase === 'waiting' && (
            <Card style={{ marginBottom: '24px', background: 'rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(10px)' }}>
              <Title level={2} style={{ textAlign: 'center', color: 'white', marginBottom: '16px' }}>
                プレイヤーを待機中...
              </Title>
              <Space direction="vertical" size="large" style={{ textAlign: 'center', width: '100%' }}>
                <Space direction="vertical" size="small">
                  <Text style={{ color: 'white', display: 'block', marginBottom: '8px' }}>
                    ゲームID（相手に共有してください）：
                  </Text>
                  <Space>
                    <Input
                      value={gameId}
                      readOnly
                      size="large"
                      style={{ fontSize: '24px', fontWeight: 'bold', textAlign: 'center' }}
                    />
                    <Button
                      type="primary"
                      icon={<CopyOutlined />}
                      onClick={() => copyToClipboard(gameId)}
                    />
                  </Space>
                </Space>
                <Space>
                  <Spin indicator={<ReloadOutlined style={{ fontSize: 16, color: '#1890ff' }} spin />} />
                  <Text style={{ color: '#e6f7ff' }}>相手プレイヤーの参加を待っています...</Text>
                </Space>
              </Space>
            </Card>
          )}

          {(gamePhase === 'playing' || gamePhase === 'finished') && (
            <>
              <Card style={{ marginBottom: '24px', background: 'rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(10px)' }}>
                <Row justify="space-between" align="middle">
                  <Col>
                    <Space>
                      <Badge count={getStoneCount(BLACK)} color="black" />
                      <Text style={{ color: 'white' }}>黒</Text>
                      {myColor === BLACK && (
                        <Text style={{ color: '#faad14' }}>（あなた）</Text>
                      )}
                    </Space>
                  </Col>
                  <Col>
                    <Space direction="vertical" size="small" style={{ textAlign: 'center' }}>
                      <Text style={{ color: '#e6f7ff', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                        ゲームID: {gameId}
                      </Text>
                      {gamePhase === 'playing' && (
                        <Space direction="vertical" size="small">
                          <Text style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '12px', display: 'block' }}>
                            現在のターン
                          </Text>
                          <Space>
                            <Avatar
                              size="small"
                              style={{
                                backgroundColor: currentPlayer === BLACK ? 'black' : 'white',
                                border: `2px solid ${currentPlayer === BLACK ? 'white' : 'black'}`,
                              }}
                            />
                            <Text style={{ color: 'white' }}>{getColorName(currentPlayer)}</Text>
                            {currentPlayer === myColor && (
                              <Text style={{ color: '#faad14' }}>（あなたの番）</Text>
                            )}
                          </Space>
                        </Space>
                      )}
                      {gamePhase === 'finished' && (
                        <Title level={3} style={{ color: 'white', margin: 0 }}>
                          {getResultMessage(gameResult)}
                        </Title>
                      )}
                    </Space>
                  </Col>
                  <Col>
                    <Space>
                      <Badge count={getStoneCount(WHITE)} color="white" />
                      <Text style={{ color: 'white' }}>白</Text>
                      {myColor === WHITE && (
                        <Text style={{ color: '#faad14' }}>（あなた）</Text>
                      )}
                    </Space>
                  </Col>
                </Row>
              </Card>

              <Card style={{ marginBottom: '24px', background: '#4caf50', border: 'none' }}>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(8, 1fr)', 
                  gap: '4px',
                  aspectRatio: '1'
                }}>
                  {board.map((row, rowIndex) =>
                    row.map((cell, colIndex) => (
                      <div
                        key={`${rowIndex}-${colIndex}`}
                        onClick={() => handleCellClick(rowIndex, colIndex)}
                        style={{
                          aspectRatio: '1',
                          backgroundColor: '#66bb6a',
                          border: '1px solid #388e3c',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: gamePhase === 'playing' && currentPlayer === myColor && board[rowIndex][colIndex] === EMPTY ? 'pointer' : 'default',
                          position: 'relative',
                          padding: 0,
                          margin: 0,
                          ...(gamePhase === 'playing' && currentPlayer === myColor && isValidMove(rowIndex, colIndex) && {
                            boxShadow: '0 0 0 2px #fdd835',
                          }),
                        }}
                      >
                        {cell === BLACK && (
                          <div
                            style={{
                              width: 'calc(100% - 8px)',
                              height: 'calc(100% - 8px)',
                              backgroundColor: 'black',
                              borderRadius: '50%',
                              border: '2px solid #424242',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                              flexShrink: 0,
                            }}
                          />
                        )}
                        {cell === WHITE && (
                          <div
                            style={{
                              width: 'calc(100% - 8px)',
                              height: 'calc(100% - 8px)',
                              backgroundColor: 'white',
                              borderRadius: '50%',
                              border: '2px solid #e0e0e0',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                              flexShrink: 0,
                            }}
                          />
                        )}
                        {gamePhase === 'playing' &&
                          currentPlayer === myColor &&
                          myColor !== null &&
                          isValidMove(rowIndex, colIndex) && (
                            <div
                              style={{
                                width: '60%',
                                height: '60%',
                                borderRadius: '50%',
                                border: `2px dashed ${myColor === BLACK ? 'black' : 'white'}`,
                                opacity: 0.5,
                                position: 'absolute',
                              }}
                            />
                          )}
                      </div>
                    ))
                  )}
                </div>
              </Card>

              <Space style={{ textAlign: 'center', width: '100%', justifyContent: 'center' }}>
                <Button type="primary" danger size="large" onClick={resetGame}>
                  新しいゲームを開始
                </Button>
              </Space>
            </>
          )}
        </Content>
    </Layout>
  );
};

