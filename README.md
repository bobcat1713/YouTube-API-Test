# YouTube Data API 調査用ミニ Web アプリ

Next.js + TypeScript で作成した、YouTube Data API の挙動調査専用ツールです。

## できること

- Google OAuth でログイン
- `channels.list(part=snippet,contentDetails,mine=true)` を実行し、`relatedPlaylists` を表示
- `relatedPlaylists.likes / watchHistory / watchLater` の ID 取得可否確認
- `playlists.list(mine=true)` で通常の再生リスト取得
- 各プレイリストに対する `playlistItems.list` 実行
- 書き込みテスト
  - `playlists.insert`
  - `playlistItems.insert`
  - `playlistItems.delete`
  - `playlistItems.update`
- API 成功/失敗の可視化（HTTP ステータス、reason、raw JSON）

> 注意: `watchHistory` / `watchLater` はアカウントや API 制限により返らない場合があります。その場合も画面上では「未取得 / 取得不可」として扱います。

---

## 必要環境

- Node.js 18 以上
- npm
- Google Cloud Console の OAuth クライアント設定

---

## Google Cloud Console 設定手順

1. Google Cloud Console でプロジェクトを作成/選択
2. 「YouTube Data API v3」を有効化
3. 「OAuth 同意画面」を設定
   - User Type: External（個人利用なら Testing で可）
   - 必要情報を入力
   - スコープに `.../auth/youtube` を許可
4. 「認証情報」→「OAuth クライアント ID」を作成
   - アプリケーションの種類: Web application
   - 承認済みリダイレクト URI に以下を追加
     - `http://localhost:3000/api/auth/callback/google`
5. 発行された Client ID / Client Secret を控える

---

## セットアップ

```bash
npm install
cp .env.example .env
```

`.env` を編集:

```env
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
NEXTAUTH_SECRET=replace-with-random-32+chars
NEXTAUTH_URL=http://localhost:3000
```

`NEXTAUTH_SECRET` はランダム文字列を設定してください（例: `openssl rand -base64 32`）。

---

## 起動

```bash
npm run dev
```

ブラウザで `http://localhost:3000` を開いて、以下の順序で調査可能です。

1. Google ログイン
2. `channels.list` を実行して `relatedPlaylists` を確認
3. `playlists.list` を実行して通常プレイリストを選択
4. 各セクションで `playlistItems.list` を試行
5. 書き込みエリアで insert / delete / update を検証
6. 実行ログで API 結果を追跡

---

## 画面構成

- **A. 認証情報エリア**: ログイン状態、チャンネル名、チャンネル ID、スコープ、ログアウト
- **B. relatedPlaylists 取得エリア**: `channels.list` 実行、likes/watchHistory/watchLater 表示、raw JSON
- **C. プレイリスト調査エリア**: 通常/高評価/視聴履歴/あとで見る で `playlistItems.list`
- **D. 書き込みテストエリア**: `playlists.insert`、`playlistItems.insert/delete/update`
- **E. 実行ログエリア**: API 名、成功/失敗、HTTP ステータス、reason、メモ

---

## 補足

- DB は使用しません。
- 永続保存は最低限（選択した通常プレイリスト ID と簡易ログ）のみです。
- アクセストークンはブラウザ localStorage に保存しません。
- 調査目的のため、成功/失敗レスポンスを加工せず表示します。
