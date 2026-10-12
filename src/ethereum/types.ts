/** The type of a supported Ethereum transaction. */
export type EthereumTransactionType = "legacy" | "eip2930" | "eip1559";

/** A single entry of an EIP-2930 access list. */
export interface AccessListEntry {
    /** 20-byte address (0x-prefixed). */
    address: string;
    /** 32-byte storage keys (0x-prefixed). */
    storageKeys: string[];
}

/** A raw Ethereum transaction that has been fully parsed. */
export interface ParsedEthereumTransaction {
    /** The detected transaction type. */
    type: EthereumTransactionType;
    /** The EIP-2718 type byte (0/1/2), or null for an un-prefixed legacy transaction. */
    typeByte: 0 | 1 | 2 | null;
    /** The chain ID as a decimal string, or null when not present / unknown. */
    chainId: string | null;
    /** The sender nonce as a decimal string. */
    nonce: string;
    /** The gas price in wei as a decimal string (legacy / EIP-2930 only). */
    gasPrice: string | null;
    /** The maximum fee per gas in wei as a decimal string (EIP-1559 only). */
    maxFeePerGas: string | null;
    /** The maximum priority fee per gas in wei as a decimal string (EIP-1559 only). */
    maxPriorityFeePerGas: string | null;
    /** The gas limit as a decimal string. */
    gasLimit: string;
    /** The recipient address (checksummed), or null for contract creation. */
    to: string | null;
    /** The transferred value in wei as a decimal string. */
    value: string;
    /** The raw input data (0x-prefixed). */
    data: string;
    /** The EIP-2930 access list (empty for legacy transactions). */
    accessList: AccessListEntry[];
    /** The `v` (y-parity / EIP-155) value as a decimal string. */
    v: string;
    /** The `r` value of the signature (0x-prefixed). */
    r: string;
    /** The `s` value of the signature (0x-prefixed). */
    s: string;
    /** The keccak256 hash of the signed transaction (0x-prefixed). */
    hash: string;
    /** The sender address recovered from the signature (checksummed). */
    from: string;
}
