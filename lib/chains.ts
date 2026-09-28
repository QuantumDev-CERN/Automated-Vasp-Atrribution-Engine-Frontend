/**
 * Chains the engine can trace. Static protocol choice, not backend
 * metadata: POST /cases, POST /watchlist and the SAHYOG mock all take
 * `chain` as a free string, and the engine's adapters cover exactly these
 * five (see AUTOMATED-VASP-ATTRIBUTION-MASTER-REFERENCE.md; BSC support
 * added in M15). If the backend ever exposes a supported-chains endpoint,
 * replace this import with that call.
 */
export const CHAINS = ["ethereum", "bitcoin", "tron", "solana", "bsc"] as const;
export type Chain = (typeof CHAINS)[number];
