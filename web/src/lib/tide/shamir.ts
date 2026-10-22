export type Share = { x: number; y: Uint8Array };

const expTable = new Uint8Array(512);
const logTable = new Uint8Array(256);

function buildTables() {
  let value = 1;
  for (let index = 0; index < 255; index += 1) {
    expTable[index] = value;
    logTable[value] = index;
    const doubled = ((value << 1) ^ (value & 0x80 ? 0x1b : 0)) & 0xff;
    value = doubled ^ value;
  }
  for (let index = 255; index < 512; index += 1) {
    expTable[index] = expTable[index - 255];
  }
}

buildTables();

export function multiply(a: number, b: number) {
  if (a === 0 || b === 0) return 0;
  return expTable[logTable[a] + logTable[b]];
}

export function divide(a: number, b: number) {
  if (b === 0) throw new Error("Division by zero in GF(256).");
  if (a === 0) return 0;
  return expTable[(logTable[a] + 255 - logTable[b]) % 255];
}

function randomBytes(length: number) {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

export function splitSecret(secret: Uint8Array, count: number, threshold: number): Share[] {
  if (threshold < 2 || threshold > count || count > 255) throw new Error("Invalid share settings.");
  const shares: Share[] = [];
  for (let x = 1; x <= count; x += 1) shares.push({ x, y: new Uint8Array(secret.length) });
  for (let position = 0; position < secret.length; position += 1) {
    const coefficients = randomBytes(threshold);
    coefficients[0] = secret[position];
    for (const share of shares) {
      let result = 0;
      for (let degree = threshold - 1; degree >= 0; degree -= 1) {
        result = multiply(result, share.x) ^ coefficients[degree];
      }
      share.y[position] = result;
    }
  }
  return shares;
}

export function combineShares(shares: Share[]): Uint8Array<ArrayBuffer> {
  if (shares.length === 0) throw new Error("No shares to combine.");
  const xs = shares.map((share) => share.x);
  if (new Set(xs).size !== xs.length) throw new Error("Shares must come from distinct nodes.");
  const length = shares[0].y.length;
  const secret = new Uint8Array(length);
  for (let position = 0; position < length; position += 1) {
    let value = 0;
    for (let i = 0; i < shares.length; i += 1) {
      let weight = 1;
      for (let j = 0; j < shares.length; j += 1) {
        if (i === j) continue;
        weight = multiply(weight, divide(shares[j].x, shares[i].x ^ shares[j].x));
      }
      value ^= multiply(shares[i].y[position], weight);
    }
    secret[position] = value;
  }
  return secret;
}
