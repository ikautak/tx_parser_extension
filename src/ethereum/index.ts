import type { Hex, TransactionSerialized } from "viem";
import { getAddress, keccak256, parseTransaction, recoverTransactionAddress } from "viem";
import type { ParsedEthereumTransaction } from "./types";

export type { AccessListEntry, EthereumTransactionType, ParsedEthereumTransaction } from "./types";

/**
 * Parse a raw (RLP-encoded) signed Ethereum transaction and recover its sender.
 *
 * Supports legacy transactions (with or without the EIP-2718 type-0 prefix),
 * EIP-2930 (type 1) and EIP-1559 (type 2). Parsing and signature recovery are
 * backed by viem's `parseTransaction` / `recoverTransactionAddress`.
 *
 * @param rawHex - A raw transaction hex string, with or without the 0x prefix.
 * @returns The parsed transaction (decimal strings, checksummed addresses).
 * @throws An Error (Japanese message) when the input is not a valid signed transaction.
 */
export async function parseEthereumTransaction(rawHex: string): Promise<ParsedEthereumTransaction> {
    const hex = normalizeRawHex(rawHex);

    // viem's parseTransaction picks the parser from the EIP-2718 type byte,
    // but does not accept the type-0 (0x00) prefix: strip it and let viem
    // parse the payload as a legacy transaction.
    let body: Hex = hex;
    let typeByte: 0 | 1 | 2 | null = null;
    if (hex.length >= 4) {
        const firstByte = Number(BigInt(hex.slice(0, 4)));
        if (firstByte === 0x00 || firstByte === 0x01 || firstByte === 0x02) {
            typeByte = firstByte;
            if (firstByte === 0x00) body = `0x${hex.slice(4)}` as Hex;
        }
    }

    const tx = parseTransaction(body);
    if (tx.type !== "legacy" && tx.type !== "eip2930" && tx.type !== "eip1559") {
        throw new Error(`サポートされていないトランザクションタイプです: ${tx.type}`);
    }
    const { r, s, v, yParity } = tx;
    if (v === undefined || r === undefined || s === undefined) {
        throw new Error("署名（v, r, s）がありません。signed transaction が必要です。");
    }

    const from = await recoverTransactionAddress({
        serializedTransaction: body as TransactionSerialized,
    });
    const parity = yParity ?? (v === 28n ? 1 : 0);
    return {
        type: tx.type,
        typeByte,
        chainId: tx.chainId === undefined ? null : String(tx.chainId),
        nonce: String(tx.nonce ?? 0),
        gasPrice: tx.gasPrice === undefined ? null : tx.gasPrice.toString(),
        maxFeePerGas: tx.maxFeePerGas === undefined ? null : tx.maxFeePerGas.toString(),
        maxPriorityFeePerGas:
            tx.maxPriorityFeePerGas === undefined ? null : tx.maxPriorityFeePerGas.toString(),
        gasLimit: (tx.gas ?? 0n).toString(),
        to: tx.to ? getAddress(tx.to) : null,
        value: (tx.value ?? 0n).toString(),
        data: tx.data ?? "0x",
        accessList: (tx.accessList ?? []).map((entry) => ({
            address: getAddress(entry.address),
            storageKeys: [...entry.storageKeys],
        })),
        // Legacy: the raw v (27/28 or EIP-155 value). Typed: the y-parity (0/1).
        v: tx.type === "legacy" ? v.toString() : String(parity),
        r,
        s,
        hash: keccak256(hex),
        from: getAddress(from),
    };
}

function normalizeRawHex(input: string): Hex {
    const trimmed = input.trim();
    if (trimmed === "") {
        throw new Error("入力されていません。raw transaction (0x...) を貼り付けてください。");
    }
    const body = trimmed.toLowerCase().startsWith("0x") ? trimmed.slice(2) : trimmed;
    if (body === "" || !/^[0-9a-fA-F]+$/.test(body)) {
        throw new Error("16 進文字列（0x...）でありません。");
    }
    return `0x${body.toLowerCase()}` as Hex;
}
