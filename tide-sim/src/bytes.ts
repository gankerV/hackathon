export function toBase64(data: ArrayBuffer | Uint8Array): string {
  return Buffer.from(data instanceof Uint8Array ? data : new Uint8Array(data)).toString("base64");
}

export function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(Buffer.from(text, "base64"));
}

export function utf8(text: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(Buffer.from(text, "utf8"));
}

export function randomHex(size: number): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(size))).toString("hex");
}
