import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";

const encoder = new TextEncoder();

export function sha256Hex(input: string): string {
  return bytesToHex(sha256(encoder.encode(input)));
}
