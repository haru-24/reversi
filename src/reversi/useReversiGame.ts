import { useCallback, useMemo, useState } from 'react';
import { database, isFirebaseConfigured } from '../firebase';
import {
  ref,
  set,
  update,
  onValue,
  off,
  get,
  type DataSnapshot,
  type DatabaseReference,
} from 'firebase/database';
import {
  BLACK,
  WHITE,
  EMPTY,
  type Board,
  type PlayerColor,
  type GamePhase,
  type GameResult,
  type Position,
  canFlip,
  createInitialBoard,
  createInitialGameState,
  generateGameId,
  generatePlayerId,
  getValidMoves,
} from './logic';

export interface UseReversiGameState {
  // game
  board: Board;
  currentPlayer: PlayerColor;
  gamePhase: GamePhase;
  gameResult: GameResult;
  gameId: string;
  isConnected: boolean;
  opponentConnected: boolean;
  // me
  myColor: PlayerColor | null;
  myPlayerId: string;
  // inputs
  joinGameId: string;
  setJoinGameId: (id: string) => void;
  // refs
  gameStateRef: DatabaseReference | null;

  // derived
  validMoves: Position[];
  isValidMove: (row: number, col: number) => boolean;

  // actions
  createGame: () => Promise<void>;
  joinGame: () => Promise<void>;
  makeMove: (row: number, col: number, player: PlayerColor) => Promise<boolean>;
  handleCellClick: (row: number, col: number) => void;
  resetGame: () => void;
}

export const useReversiGame = (): UseReversiGameState => {
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

  const getValidMovesMemo = useCallback(
    (boardArg: Board, player: PlayerColor): Position[] =>
      getValidMoves(boardArg, player),
    []
  );

  const makeMove = useCallback(
    async (row: number, col: number, player: PlayerColor): Promise<boolean> => {
      if (!gameStateRef || gamePhase !== 'playing' || currentPlayer !== myColor)
        return false;

      const toFlip = canFlip(board, row, col, player);
      if (toFlip.length === 0) return false;

      const newBoard: Board = board.map(r => [...r]);
      newBoard[row][col] = player;
      toFlip.forEach(([r, c]) => {
        newBoard[r][c] = player;
      });

      const nextPlayer: PlayerColor = player === BLACK ? WHITE : BLACK;
      const nextValidMoves = getValidMovesMemo(newBoard, nextPlayer);

      let newGamePhase: GamePhase = 'playing';
      let newGameResult: GameResult = null;

      if (nextValidMoves.length === 0) {
        const currentValidMoves = getValidMovesMemo(newBoard, player);
        if (currentValidMoves.length === 0) {
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
    },
    [board, currentPlayer, gamePhase, gameStateRef, getValidMovesMemo, myColor]
  );

  const createGame = useCallback(async (): Promise<void> => {
    if (!isFirebaseConfigured) return;

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

      onValue(gameRef, handleGameStateUpdate);
    } catch (error) {
      console.error('Failed to create game:', error);
    }
  }, [myPlayerId]);

  const joinGame = useCallback(async (): Promise<void> => {
    if (!isFirebaseConfigured) return;
    if (!joinGameId) return;

    const gameRef = ref(database, `games/${joinGameId}`);

    try {
      const snapshot = await get(gameRef);
      const gameState = snapshot.val();

      if (!snapshot.exists()) {
        return;
      }

      if (gameState.players.white) {
        return;
      }

      await update(gameRef, {
        'players/white': myPlayerId,
        gamePhase: 'playing',
      });

      setGameId(joinGameId);
      setMyColor(WHITE);
      setGameStateRef(gameRef);
      setIsConnected(true);

      onValue(gameRef, handleGameStateUpdate);
    } catch (error) {
      console.error('Failed to join game:', error);
    }
  }, [joinGameId, myPlayerId]);

  const handleGameStateUpdate = useCallback(
    (snapshot: DataSnapshot) => {
      const gameState = snapshot.val();
      if (!gameState) return;

      setBoard(gameState.board);
      setCurrentPlayer(gameState.currentPlayer);
      setGamePhase(gameState.gamePhase);
      setGameResult(gameState.gameResult);

      const isOpponentConnected =
        myColor === BLACK
          ? !!gameState.players.white
          : !!gameState.players.black;
      setOpponentConnected(isOpponentConnected);
    },
    [myColor]
  );

  const handleCellClick = useCallback(
    (row: number, col: number): void => {
      if (
        gamePhase !== 'playing' ||
        currentPlayer !== myColor ||
        board[row][col] !== EMPTY
      )
        return;
      if (myColor == null) return;
      void makeMove(row, col, myColor);
    },
    [board, currentPlayer, gamePhase, makeMove, myColor]
  );

  const resetGame = useCallback((): void => {
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
  }, [gameStateRef, handleGameStateUpdate]);

  const validMoves: Position[] = useMemo(() => {
    if (
      gamePhase !== 'playing' ||
      currentPlayer !== myColor ||
      myColor === null
    )
      return [];
    return getValidMoves(board, myColor);
  }, [board, currentPlayer, gamePhase, myColor]);

  const isValidMove = useCallback(
    (row: number, col: number): boolean =>
      validMoves.some(([r, c]) => r === row && c === col),
    [validMoves]
  );

  return {
    board,
    currentPlayer,
    gamePhase,
    gameResult,
    gameId,
    isConnected,
    opponentConnected,
    myColor,
    myPlayerId,
    joinGameId,
    setJoinGameId,
    gameStateRef,
    validMoves,
    isValidMove,
    createGame,
    joinGame,
    makeMove,
    handleCellClick,
    resetGame,
  };
};
