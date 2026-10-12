export {};

/**
 * Chains the webview can parse.
 *
 * When adding a new chain, add its parser to `parsers` in src/extension.ts
 * and a radio option here. The `value` must match the key in that registry.
 */
const CHAIN_OPTIONS = [
    {
        value: "ethereum",
        label: "Ethereum",
        hint: "raw transaction（0x...）を貼り付けて Parse をクリックしてください。Legacy / EIP-2930 / EIP-1559 をサポートします。",
    },
] as const;

type Chain = (typeof CHAIN_OPTIONS)[number]["value"];

interface AccessListEntry {
    address: string;
    storageKeys: string[];
}

interface ParsedTransaction {
    type: "legacy" | "eip2930" | "eip1559";
    typeByte: 0 | 1 | 2 | null;
    chainId: string | null;
    nonce: string;
    gasPrice: string | null;
    maxFeePerGas: string | null;
    maxPriorityFeePerGas: string | null;
    gasLimit: string;
    to: string | null;
    value: string;
    data: string;
    accessList: AccessListEntry[];
    v: string;
    r: string;
    s: string;
    hash: string;
    from: string;
}

interface VsCodeApi {
    postMessage(message: unknown): void;
}

declare global {
    // Provided by the VSCode webview host.
    function acquireVsCodeApi(): VsCodeApi;
}

const vscodeApi = acquireVsCodeApi();

function requireElement<T extends HTMLElement>(selector: string): T {
    const element = document.querySelector(selector);
    if (!element) {
        throw new Error(`UI 要素が見つかりません: ${selector}`);
    }
    return element as T;
}

const input = requireElement<HTMLTextAreaElement>("#raw-input");
const parseButton = requireElement<HTMLButtonElement>("#parse-button");
const resultBox = requireElement<HTMLDivElement>("#result");
const errorBox = requireElement<HTMLDivElement>("#error");
const chainSelect = requireElement<HTMLDivElement>("#chain-select");
const hint = requireElement<HTMLParagraphElement>("#hint");

renderChainOptions();

function renderChainOptions(): void {
    chainSelect.replaceChildren(
        ...CHAIN_OPTIONS.map((option) => {
            const label = document.createElement("label");
            label.className = "chain-option";
            const radio = document.createElement("input");
            radio.type = "radio";
            radio.name = "chain";
            radio.value = option.value;
            radio.addEventListener("change", updateHint);
            label.append(radio, option.label);
            return label;
        }),
    );
    const first = chainSelect.querySelector<HTMLInputElement>("input[name='chain']");
    if (first) first.checked = true;
    updateHint();
}

function selectedChain(): Chain {
    const checked = chainSelect.querySelector<HTMLInputElement>("input[name='chain']:checked");
    if (!checked) {
        throw new Error("UI 要素が見つかりません: input[name='chain']:checked");
    }
    return checked.value as Chain;
}

function updateHint(): void {
    const option = CHAIN_OPTIONS.find((candidate) => candidate.value === selectedChain());
    hint.textContent = option?.hint ?? "";
}

parseButton.addEventListener("click", () => {
    const value = input.value.trim();
    if (value === "") {
        showError("raw transaction（0x...）を入力してください。");
        return;
    }
    clearOutput();
    parseButton.disabled = true;
    vscodeApi.postMessage({ type: "parse", chain: selectedChain(), data: value });
});

window.addEventListener("message", (event: MessageEvent) => {
    parseButton.disabled = false;
    const message = event.data as
        | { type?: string; data?: ParsedTransaction; message?: string }
        | undefined;
    if (!message || typeof message !== "object") return;
    if (message.type === "result" && message.data) {
        renderResult(message.data);
    } else if (message.type === "error") {
        showError(message.message ?? "不明なエラーが発生しました。");
    }
});

function renderResult(tx: ParsedTransaction): void {
    errorBox.classList.add("hidden");

    const rows: string[] = [];
    rows.push(section("Transaction"));
    rows.push(row("Type", typeLabel(tx)));
    rows.push(row("Hash", tx.hash));
    rows.push(row("From", tx.from));
    rows.push(row("To", tx.to ?? "（コントラクト生成）"));
    rows.push(row("Nonce", tx.nonce));
    if (tx.chainId !== null) {
        rows.push(row("Chain ID", tx.chainId));
    }
    if (tx.type === "eip1559") {
        rows.push(row("Max Fee Per Gas", formatWei(tx.maxFeePerGas ?? "0", "Gwei")));
        rows.push(row("Max Priority Fee", formatWei(tx.maxPriorityFeePerGas ?? "0", "Gwei")));
    } else {
        rows.push(row("Gas Price", formatWei(tx.gasPrice ?? "0", "Gwei")));
    }
    rows.push(row("Gas Limit", tx.gasLimit));
    rows.push(row("Value", formatWei(tx.value, "ETH")));
    rows.push(row("Data", formatData(tx.data)));

    if (tx.accessList.length === 0) {
        rows.push(row("Access List", "（なし）"));
    } else {
        tx.accessList.forEach((entry, index) => {
            rows.push(
                row(
                    `Access List [${index}]`,
                    `${entry.address} — ${entry.storageKeys.length} ストレージキー`,
                ),
            );
        });
    }

    rows.push(section("Signature"));
    rows.push(row("v", tx.v));
    rows.push(row("r", tx.r));
    rows.push(row("s", tx.s));

    resultBox.innerHTML = rows.join("");
    resultBox.classList.remove("hidden");
}

function typeLabel(tx: ParsedTransaction): string {
    if (tx.type === "legacy") return tx.typeByte === 0 ? "Legacy (type 0)" : "Legacy";
    if (tx.type === "eip2930") return "EIP-2930 (type 1)";
    return "EIP-1559 (type 2)";
}

/**
 * Format a wei amount as "<wei> wei (<readable> <unit>)".
 *
 * The readable part is truncated (not rounded) to at most 12 decimal places.
 */
function formatWei(wei: string, unit: "ETH" | "Gwei"): string {
    const divisor = unit === "ETH" ? 10n ** 18n : 10n ** 9n;
    const value = BigInt(wei);
    const intPart = value / divisor;
    const remainder = value % divisor;
    if (remainder === 0n) {
        return `${wei} wei (${intPart.toString()} ${unit})`;
    }
    const maxDecimals = 12;
    let fraction = ((remainder * 10n ** BigInt(maxDecimals)) / divisor)
        .toString()
        .padStart(maxDecimals, "0");
    fraction = fraction.replace(/0+$/, "");
    return `${wei} wei (${intPart.toString()}.${fraction} ${unit})`;
}

function formatData(data: string): string {
    const bytes = (data.length - 2) / 2;
    if (bytes === 0) return "（空）";
    const preview = data.length > 70 ? `${data.slice(0, 68)}...` : data;
    return `${preview}（${bytes} bytes）`;
}

function section(title: string): string {
    return `<div class="section">${escapeHtml(title)}</div>`;
}

function row(label: string, value: string): string {
    return `<div class="row"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div></div>`;
}

function escapeHtml(text: string): string {
    const replacements: Record<string, string> = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    };
    return text.replace(/[&<>"']/g, (char) => replacements[char] ?? char);
}

function showError(message: string): void {
    resultBox.classList.add("hidden");
    errorBox.textContent = message;
    errorBox.classList.remove("hidden");
}

function clearOutput(): void {
    resultBox.classList.add("hidden");
    resultBox.innerHTML = "";
    errorBox.textContent = "";
    errorBox.classList.add("hidden");
}
