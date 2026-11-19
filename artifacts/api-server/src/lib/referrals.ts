import { createHash } from "node:crypto";

const CODE_ALPHABET_SIZE = 36n;
const CODE_LENGTH = 8;
const CODE_SPACE = CODE_ALPHABET_SIZE ** BigInt(CODE_LENGTH);

export function referralCodeCandidate(userId: string, attempt = 0): string {
  const digest = createHash("sha256")
    .update(`${userId}\0${attempt}`)
    .digest("hex");
  const baseCode = (BigInt(`0x${digest}`) % CODE_SPACE)
    .toString(36)
    .toUpperCase()
    .padStart(CODE_LENGTH, "0");
  const characters = baseCode.split("");
  if (!/[A-Z]/.test(baseCode)) {
    characters[0] = String.fromCharCode(65 + Number(BigInt(`0x${digest.slice(0, 8)}`) % 26n));
  }
  if (!/[0-9]/.test(baseCode)) {
    characters[1] = String(Number(BigInt(`0x${digest.slice(8, 16)}`) % 10n));
  }
  return characters.join("");
}

export async function findAvailableReferralCode(
  userId: string,
  isTaken: (code: string) => Promise<boolean>,
): Promise<string> {
  for (let attempt = 0; attempt < 128; attempt += 1) {
    const code = referralCodeCandidate(userId, attempt);
    if (!(await isTaken(code))) return code;
  }
  throw new Error("A unique referral code could not be allocated.");
}
