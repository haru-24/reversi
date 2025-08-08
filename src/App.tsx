import React from 'react';
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
import { isFirebaseConfigured } from './firebase';
import { useReversiGame } from './reversi/useReversiGame';
import {
  BLACK,
  WHITE,
  EMPTY,
  getColorName,
  getResultMessage,
  getStoneCount,
} from './reversi/logic';

const { Title, Text } = Typography;
const { Content } = Layout;

export const ReversiUI: React.FC = () => {
  const {
    board,
    currentPlayer,
    gamePhase,
    gameResult,
    gameId,
    isConnected,
    opponentConnected,
    lastMove,
    myColor,
    joinGameId,
    setJoinGameId,
    isValidMove,
    createGame,
    joinGame,
    handleCellClick,
    resetGame,
  } = useReversiGame();

  const copyToClipboard = async (text: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      message.success('ゲームIDをコピーしました');
    } catch (error) {
      console.error('Failed to copy text:', error);
      message.error('コピーに失敗しました');
    }
  };

  return (
    <Layout
      style={{
        minHeight: '100vh',
        background:
          'linear-gradient(135deg, #1b5e20 0%, #2e7d32 50%, #1b5e20 100%)',
      }}
    >
      <Content
        style={{ maxWidth: '1200px', margin: '0 auto', padding: '16px' }}
      >
        <Space
          direction="vertical"
          style={{ textAlign: 'center', marginBottom: '24px', width: '100%' }}
        >
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
                  <WifiOutlined
                    style={{ color: '#ff4d4f', transform: 'rotate(45deg)' }}
                  />
                  <Text style={{ color: '#e6f7ff' }}>未接続</Text>
                </>
              )}
            </Space>
            {gamePhase === 'playing' && (
              <Space>
                <UserOutlined style={{ color: '#1890ff' }} />
                <Text style={{ color: '#e6f7ff' }}>
                  {opponentConnected
                    ? '対戦相手: オンライン'
                    : '対戦相手: 待機中'}
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
          <Card
            style={{
              marginBottom: '24px',
              background: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <Title
              level={2}
              style={{
                textAlign: 'center',
                color: 'white',
                marginBottom: '16px',
              }}
            >
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
                  onChange={e => setJoinGameId(e.target.value.toUpperCase())}
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
          <Card
            style={{
              marginBottom: '24px',
              background: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <Title
              level={2}
              style={{
                textAlign: 'center',
                color: 'white',
                marginBottom: '16px',
              }}
            >
              プレイヤーを待機中...
            </Title>
            <Space
              direction="vertical"
              size="large"
              style={{ textAlign: 'center', width: '100%' }}
            >
              <Space direction="vertical" size="small">
                <Text
                  style={{
                    color: 'white',
                    display: 'block',
                    marginBottom: '8px',
                  }}
                >
                  ゲームID（相手に共有してください）：
                </Text>
                <Space>
                  <Input
                    value={gameId}
                    readOnly
                    size="large"
                    style={{
                      fontSize: '24px',
                      fontWeight: 'bold',
                      textAlign: 'center',
                    }}
                  />
                  <Button
                    type="primary"
                    icon={<CopyOutlined />}
                    onClick={() => copyToClipboard(gameId)}
                  />
                </Space>
              </Space>
              <Space>
                <Spin
                  indicator={
                    <ReloadOutlined
                      style={{ fontSize: 16, color: '#1890ff' }}
                      spin
                    />
                  }
                />
                <Text style={{ color: '#e6f7ff' }}>
                  相手プレイヤーの参加を待っています...
                </Text>
              </Space>
            </Space>
          </Card>
        )}

        {(gamePhase === 'playing' || gamePhase === 'finished') && (
          <>
            <Card
              style={{
                marginBottom: '24px',
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
              }}
            >
              <Row justify="space-between" align="middle">
                <Col>
                  <Space>
                    <Badge count={getStoneCount(board, BLACK)} color="black" />
                    <Text style={{ color: 'white' }}>黒</Text>
                    {myColor === BLACK && (
                      <Text style={{ color: '#faad14' }}>（あなた）</Text>
                    )}
                  </Space>
                </Col>
                <Col>
                  <Space
                    direction="vertical"
                    size="small"
                    style={{ textAlign: 'center' }}
                  >
                    <Text
                      style={{
                        color: '#e6f7ff',
                        fontSize: '12px',
                        display: 'block',
                        marginBottom: '4px',
                      }}
                    >
                      ゲームID: {gameId}
                    </Text>
                    {gamePhase === 'playing' && (
                      <Space direction="vertical" size="small">
                        <Text
                          style={{
                            color: 'rgba(255, 255, 255, 0.8)',
                            fontSize: '12px',
                            display: 'block',
                          }}
                        >
                          現在のターン
                        </Text>
                        <Space>
                          <Avatar
                            size="small"
                            style={{
                              backgroundColor:
                                currentPlayer === BLACK ? 'black' : 'white',
                              border: `2px solid ${currentPlayer === BLACK ? 'white' : 'black'}`,
                            }}
                          />
                          <Text style={{ color: 'white' }}>
                            {getColorName(currentPlayer)}
                          </Text>
                          {currentPlayer === myColor && (
                            <Text style={{ color: '#faad14' }}>
                              （あなたの番）
                            </Text>
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
                    <Badge count={getStoneCount(board, WHITE)} color="white" />
                    <Text style={{ color: 'white' }}>白</Text>
                    {myColor === WHITE && (
                      <Text style={{ color: '#faad14' }}>（あなた）</Text>
                    )}
                  </Space>
                </Col>
              </Row>
            </Card>

            <Card
              style={{
                marginBottom: '24px',
                background: '#4caf50',
                border: 'none',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(8, 1fr)',
                  gap: '4px',
                  aspectRatio: '1',
                }}
              >
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
                        cursor:
                          gamePhase === 'playing' &&
                          currentPlayer === myColor &&
                          board[rowIndex][colIndex] === EMPTY
                            ? 'pointer'
                            : 'default',
                        position: 'relative',
                        padding: 0,
                        margin: 0,
                        ...(gamePhase === 'playing' &&
                          currentPlayer === myColor &&
                          isValidMove(rowIndex, colIndex) && {
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
                      {lastMove &&
                        lastMove.player !== myColor &&
                        lastMove.row === rowIndex &&
                        lastMove.col === colIndex && (
                          <div
                            style={{
                              position: 'absolute',
                              inset: 0,
                              borderRadius: '50%',
                              border: '3px solid #ffeb3b',
                              boxShadow:
                                '0 0 8px rgba(255,235,59,0.9), 0 0 16px rgba(255,235,59,0.6)',
                              pointerEvents: 'none',
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

            <Space
              style={{
                textAlign: 'center',
                width: '100%',
                justifyContent: 'center',
              }}
            >
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
