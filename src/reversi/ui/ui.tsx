import React from 'react';
import {
  Button,
  Card,
  Input,
  Typography,
  Space,
  Divider,
  Alert,
  Spin,
  message,
  Layout,
} from 'antd';
import {
  CopyOutlined,
  UserOutlined,
  WifiOutlined,
  ReloadOutlined,
  XOutlined,
} from '@ant-design/icons';
import { isFirebaseConfigured } from '../../firebase';
import { useReversiGame } from '../useReversiGame';
import {
  BLACK,
  WHITE,
  EMPTY,
  getColorName,
  getResultMessage,
  getStoneCount,
} from '../logic';

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
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Content
        style={{
          maxWidth: '400px',
          margin: '0 auto',
          padding: '12px',
          width: '100%',
          flex: '1 1 auto',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
        }}
      >
        <div
          style={{ textAlign: 'center', marginBottom: '16px', width: '100%' }}
        >
          <Title
            level={2}
            style={{ color: 'white', marginBottom: '8px', fontSize: '24px' }}
          >
            リバーシ
          </Title>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '16px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {isConnected ? (
                <>
                  <WifiOutlined
                    style={{ color: '#52c41a', fontSize: '14px' }}
                  />
                  <Text style={{ color: '#e6f7ff', fontSize: '12px' }}>
                    接続済み
                  </Text>
                </>
              ) : (
                <>
                  <WifiOutlined
                    style={{
                      color: '#ff4d4f',
                      transform: 'rotate(45deg)',
                      fontSize: '14px',
                    }}
                  />
                  <Text style={{ color: '#e6f7ff', fontSize: '12px' }}>
                    未接続
                  </Text>
                </>
              )}
            </div>
            {gamePhase === 'playing' && (
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <UserOutlined style={{ color: '#1890ff', fontSize: '14px' }} />
                <Text style={{ color: '#e6f7ff', fontSize: '12px' }}>
                  {opponentConnected
                    ? '対戦相手: オンライン'
                    : '対戦相手: 待機中'}
                </Text>
              </div>
            )}
          </div>
        </div>

        {!isFirebaseConfigured && (
          <Alert
            message="Firebase設定が必要です"
            description="FIREBASE_CONFIGオブジェクトに実際のFirebase設定値を入力してください。Firebase Console → プロジェクト設定 → SDK設定と構成 から取得できます。"
            type="error"
            showIcon
            style={{ marginBottom: '16px', fontSize: '12px' }}
          />
        )}

        {gamePhase === 'setup' && (
          <Card
            style={{
              marginBottom: '16px',
              background: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <Title
              level={3}
              style={{
                textAlign: 'center',
                color: 'white',
                marginBottom: '16px',
                fontSize: '18px',
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
              marginBottom: '16px',
              background: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <Title
              level={3}
              style={{
                textAlign: 'center',
                color: 'white',
                marginBottom: '16px',
                fontSize: '18px',
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
                    fontSize: '14px',
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
                      fontSize: '20px',
                      fontWeight: 'bold',
                      textAlign: 'center',
                      width: '120px',
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
                <Text style={{ color: '#e6f7ff', fontSize: '12px' }}>
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
                marginBottom: '16px',
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                padding: '12px 16px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <div style={{ flex: '0 0 auto', minWidth: '80px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '14px',
                    }}
                  >
                    <div
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        backgroundColor: 'black',
                        border: '2px solid white',
                        fontSize: '10px',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold',
                      }}
                    >
                      {getStoneCount(board, BLACK)}
                    </div>
                    <Text style={{ color: 'white', fontSize: '14px' }}>黒</Text>
                    {myColor === BLACK && (
                      <Text style={{ color: '#faad14', fontSize: '10px' }}>
                        あなた
                      </Text>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    flex: '1 1 auto',
                    textAlign: 'center',
                    minHeight: '60px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: '#e6f7ff',
                      fontSize: '10px',
                      marginBottom: '4px',
                    }}
                  >
                    ID: {gameId}
                  </Text>
                  {gamePhase === 'playing' && (
                    <div>
                      <Text
                        style={{
                          color: 'rgba(255, 255, 255, 0.8)',
                          fontSize: '10px',
                          display: 'block',
                          marginBottom: '2px',
                        }}
                      >
                        現在のターン
                      </Text>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                        }}
                      >
                        <div
                          style={{
                            width: '16px',
                            height: '16px',
                            borderRadius: '50%',
                            backgroundColor:
                              currentPlayer === BLACK ? 'black' : 'white',
                            border: `2px solid ${currentPlayer === BLACK ? 'white' : 'black'}`,
                          }}
                        />
                        <Text style={{ color: 'white', fontSize: '12px' }}>
                          {getColorName(currentPlayer)}
                        </Text>
                        {currentPlayer === myColor && (
                          <Text style={{ color: '#faad14', fontSize: '10px' }}>
                            ●
                          </Text>
                        )}
                      </div>
                    </div>
                  )}
                  {gamePhase === 'finished' && (
                    <Title
                      level={4}
                      style={{ color: 'white', margin: 0, fontSize: '16px' }}
                    >
                      {getResultMessage(gameResult)}
                    </Title>
                  )}
                </div>

                <div style={{ flex: '0 0 auto', minWidth: '80px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: '6px',
                      fontSize: '14px',
                    }}
                  >
                    {myColor === WHITE && (
                      <Text style={{ color: '#faad14', fontSize: '10px' }}>
                        あなた
                      </Text>
                    )}
                    <Text style={{ color: 'white', fontSize: '14px' }}>白</Text>
                    <div
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        backgroundColor: 'white',
                        border: '2px solid black',
                        fontSize: '10px',
                        color: 'black',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold',
                      }}
                    >
                      {getStoneCount(board, WHITE)}
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <Card
              style={{
                marginBottom: '16px',
                background: '#4caf50',
                border: 'none',
                padding: '8px',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(8, 1fr)',
                  gap: '2px',
                  aspectRatio: '1',
                  width: '100%',
                  maxWidth: '340px',
                  margin: '0 auto',
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
                        minHeight: '36px',
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

            <div
              style={{
                textAlign: 'center',
                width: '100%',
                padding: '8px 0',
              }}
            >
              <Button type="primary" danger size="large" onClick={resetGame}>
                新しいゲームを開始
              </Button>
            </div>
          </>
        )}

        {/* フッター */}
        <Space
          direction="vertical"
          size="small"
          style={{
            marginTop: 'auto',
            flexShrink: 0,
            width: '100%',
          }}
        >
          <Divider
            style={{
              borderColor: 'rgba(255, 255, 255, 0.1)',
              margin: '16px 0',
            }}
          />
          <Space
            direction="horizontal"
            size="small"
            style={{
              justifyContent: 'center',
              width: '100%',
              padding: '8px 0',
            }}
          >
            <Text
              style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '12px' }}
            >
              Made by haru_taro
            </Text>
            <Typography.Link
              href="https://x.com/haru_taro_24"
              target="_blank"
              style={{
                color: 'rgba(255, 255, 255, 0.7)',
                fontSize: '14px',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <XOutlined />
            </Typography.Link>
          </Space>
        </Space>
      </Content>
    </Layout>
  );
};
