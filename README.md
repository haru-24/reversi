## Reversi (リバーシ)

Vite + React + TypeScript + Ant Design で作った、Firebase Realtime Database 同期のオンライン対戦リバーシ（オセロ）です。6文字のゲームIDを生成/入力して、友だちとすぐに対戦できます。

---

## 特長

- **オンライン対戦**: ゲームIDを共有して即対戦（参加状況を表示）
- **リアルタイム同期**: Firebase Realtime Database で盤面・手番・最終手を同期
- **直感的なUI**: 打てるマスのハイライト、直前の手の発光表示、石数カウンタ、IDコピー
- **ルール実装**: ひっくり返し判定、手番パス、終局・勝敗判定
- **モダンスタック**: React 19 + Vite 7 + TypeScript、Ant Design 5

## スタック

- **フロントエンド**: React 19, TypeScript, Vite 7
- **UI**: Ant Design 5, @ant-design/icons
- **リアルタイム**: Firebase Realtime Database
- **ユーティリティ**: ESLint / Prettier, PostCSS / Autoprefixer

---

## はじめかた

### 必要要件

- Node.js 18+（推奨: LTS）
- npm / pnpm / yarn のいずれか
- Firebase プロジェクト（Realtime Database を有効化）

### 1) 依存関係のインストール

```bash
npm install
# または
# pnpm install
# yarn install
```

### 2) Firebase 設定

1. Firebase コンソールで Web アプリを作成し、SDK 設定値を取得
2. プロジェクト直下に `.env.local` を作成し、以下を設定

```bash
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your_project.firebaseio.com
VITE_FIREBASE_PROJECT_ID=your_project
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=xxxxxxxxxxxx
VITE_FIREBASE_APP_ID=1:xxxxxxxxxxxx:web:xxxxxxxxxxxxxxxxxxxxxx
```

環境変数は `src/firebase.ts` で参照されます。未設定の場合は接続不可としてUIに警告が表示されます。

3. Realtime Database のルールは `database.rule.json` を参照（開発用の緩い設定のため、本番では必ず適切に制限してください）

### 3) 開発サーバの起動

```bash
npm run dev
```

ブラウザで `http://localhost:5173` を開きます。

Vite の開発サーバは `vite.config.ts` の `server.allowedHosts` に `.ngrok-free.app` が含まれているため、ngrok 等で外部公開も可能です。

---

## 遊び方

1. 「新しいゲームを作成（黒石・先手）」を押すと、6文字のゲームIDが表示されます。
2. 相手にゲームIDを共有します（コピーアイコンでクリップボードにコピー）。
3. 相手は「ゲームに参加する（白石・後手）」からIDを入力して参加します。
4. 自分の手番で有効なマスは破線の円でハイライトされます。クリックで石を置けます。
5. 双方が打てる手がなくなったら自動で対局終了し、勝敗が表示されます。
6. 「新しいゲームを開始」でロビーに戻ります。

---

## スクリプト

```bash
# 開発
npm run dev

# 本番ビルド
npm run build

# ローカルプレビュー（ビルド済みを配信）
npm run preview

# Lint と整形
npm run lint
npm run format
npm run format:check
```

---

## デプロイ（Firebase Hosting）

このリポジトリには `firebase.json` が含まれ、`dist` をホスティング配信します。

1. Firebase CLI をインストールしログイン：

```bash
npm install -g firebase-tools
firebase login
```

2. ビルド：

```bash
npm run build
```

3. デプロイ：

```bash
firebase deploy
# ルールのみ / ホスティングのみのデプロイ例：
# firebase deploy --only database
# firebase deploy --only hosting
```

本番環境では Realtime Database のルール（`database.rule.json`）を必ず見直してください。

---

## 開発メモ

- デバッグ用: 参加IDに `999999` を入力すると、Firebase 同期を使わないローカルモードで対戦画面を確認できます（相手接続は擬似表示）。

---

## ディレクトリ構成（抜粋）

```
.
├─ src/
│  ├─ main.tsx                # エントリ
│  ├─ App.tsx                 # 画面ルート
│  ├─ firebase.ts             # Firebase 初期化/接続可否
│  └─ reversi/
│     ├─ logic.ts             # ルール/ロジック
│     ├─ useReversiGame.ts    # ゲーム状態・Realtime 同期
│     └─ ui/
│        └─ ui.tsx            # 主要UI（Ant Design）
├─ index.html
├─ vite.config.ts
├─ firebase.json
├─ database.rule.json
└─ package.json
```

---

## ライセンス

未指定（必要に応じて追加してください）。
