# TX Parser

raw（RLP エンコード済み）の Ethereum transaction 文字列（`0x...`）を貼り付け、
Parse ボタンで内容を解析して表示するシンプルな VSCode 拡張です。

## 機能

- 画面上のラジオボタンでチェーンを選択（現在は Ethereum のみ）
- テキストボックスに `0x...` の raw transaction を貼り付け、Parse ボタンで解析
- 対応トランザクション:
  - Legacy（EIP-155 対応、EIP-2718 の type 0 プレフィックス付きにも対応）
  - EIP-2930 (type 1)
  - EIP-1559 (type 2)
- 表示項目: Type / Hash / From / To / Nonce / Chain ID / gas 系（wei + Gwei 併記）/
  Value（wei + ETH 併記）/ Data / Access List / v / r / s
- `from` は署名（r, s, v）からの公開鍵復元で導出（viem）
- 今後、Ethereum 以外のチェーンの tx にも対応できるよう、
  Ethereum 固有のコードは `src/ethereum/` に集約されています

## 使い方

1. コマンドパレットの `TX Parser: Open` で TX Parser パネルを開く
2. 画面上のラジオボタンでチェーンを選択（現在は Ethereum のみ、Ethereum が既定で選択済み）
3. テキストボックスに raw transaction の hex 文字列（`0x` 付きでもなしでも可）を貼り付ける
4. `Parse` ボタンをクリックする
5. 解析結果（またはエラーメッセージ）が表示される

### 入力例

```text
0x02f8730109843b9aca008506fc23ac0082520894fba3912ca04dd458c843e2ee08967fc04f3579c0880de0b6b3a764000080c080a08393781475f3e9564d41885387175f8809644b1fc92a7168a1c8c6e61f0f4b36a039f0236faf85d1927f0ddc830f25c09e5b382e947bfed35896650f735f4186a8
```

## 開発

- package manager: npm
- format / lint: biome
- バンドル: esbuild（extension host と webview の 2 エントリ）

```sh
npm install     # 依存のインストール
npm run build   # dist/ にバンドル
npm run watch   # 監視モード
npm run format  # biome format
npm run lint    # biome check
npm run lint:fix  # biome check + 自動修正
npm run check   # TypeScript の型チェック（tsc --noEmit）
npm run package # .vsix を生成（@vscode/vsce）
```

F5（Run Extension）で拡張機能開発用ウィンドウを起動できます。

## 実装メモ

- パース / 送信者復元 / ハッシュ計算: `viem` の `parseTransaction` /
  `recoverTransactionAddress` / `keccak256`（`src/ethereum/index.ts` に集約）
  - `parseTransaction` は EIP-2718 の type-0（`0x00`）プレフィックスを扱えないため、
    先頭バイトが `0x00` のときは除去してから legacy として渡す
  - `recoverTransactionAddress` は非同期（`parseEthereumTransaction` は `async`）
- パーシングは extension host（Node）側で実行。Webview は表示専用
  （viem を Webview に同梱しない）
- Webview はラジオボタンで選択したチェーン（`chain`）を parse メッセージに含めて送信し、
  extension host は `src/extension.ts` の `parsers` レジストリ経由で該当パーサーを呼び出す。
  新チェーン追加時はここにパーサーを登録し、`src/webview/main.ts` の `CHAIN_OPTIONS` に
  ラジオボタンの選択肢を足す
- viem は esbuild で `dist/` にバンドルするため、
  `devDependencies` にのみ宣言しています（`.vsix` に node_modules は同梱しない）
