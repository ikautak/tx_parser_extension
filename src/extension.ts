import { BaseError } from "viem";
import * as vscode from "vscode";
import { parseEthereumTransaction } from "./ethereum";

let panel: vscode.WebviewPanel | undefined;

/**
 * Supported chains.
 *
 * When adding a new chain, add its parser here and its radio option (with
 * label / hint) in the webview (`CHAIN_OPTIONS` in src/webview/main.ts).
 */
const parsers = {
    ethereum: parseEthereumTransaction,
} as const;

type Chain = keyof typeof parsers;

export function activate(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.commands.registerCommand("txParser.open", () => {
            showPanel(context);
        }),
    );
}

export function deactivate(): void {
    panel?.dispose();
    panel = undefined;
}

function showPanel(context: vscode.ExtensionContext): void {
    if (panel) {
        panel.reveal();
        return;
    }

    panel = vscode.window.createWebviewPanel("txParser", "TX Parser", vscode.ViewColumn.One, {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "dist")],
    });

    panel.webview.html = renderHtml(panel.webview, context.extensionUri);

    panel.webview.onDidReceiveMessage(
        (message: unknown) => {
            void handleParseMessage(message);
        },
        undefined,
        context.subscriptions,
    );

    panel.onDidDispose(() => {
        panel = undefined;
    });
}

async function handleParseMessage(message: unknown): Promise<void> {
    if (!panel || typeof message !== "object" || message === null) return;
    const { type, chain, data } = message as {
        type?: unknown;
        chain?: unknown;
        data?: unknown;
    };
    if (type !== "parse" || typeof data !== "string") return;
    if (typeof chain !== "string" || !(chain in parsers)) {
        await panel.webview.postMessage({
            type: "error",
            message: `未対応のチェーンです: ${chain}`,
        });
        return;
    }

    try {
        const result = await parsers[chain as Chain](data);
        await panel.webview.postMessage({ type: "result", data: result });
    } catch (error) {
        // viem's BaseError carries the clean one-line message in shortMessage
        // (error.message appends Docs / Details / Version footers).
        const text =
            error instanceof BaseError
                ? error.shortMessage
                : error instanceof Error
                  ? error.message
                  : String(error);
        await panel.webview.postMessage({ type: "error", message: text });
    }
}

function renderHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
    const cspSource = webview.cspSource.toString();
    const styleUri = webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, "dist", "webview", "style.css"),
    );
    const scriptUri = webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, "dist", "webview", "main.js"),
    );

    return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src ${cspSource}; script-src ${cspSource}; img-src ${cspSource};" />
  <link rel="stylesheet" href="${styleUri}" />
  <title>TX Parser</title>
</head>
<body>
  <h1>TX Parser</h1>
  <div id="chain-select" class="chain-select" role="radiogroup" aria-label="チェーン"></div>
  <p id="hint" class="hint"></p>
  <textarea id="raw-input" spellcheck="false"></textarea>
  <button id="parse-button" type="button">Parse</button>
  <div id="error" class="error hidden" role="alert"></div>
  <div id="result" class="result hidden"></div>
  <script src="${scriptUri}"></script>
</body>
</html>`;
}
