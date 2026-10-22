import { SignJWT, jwtVerify } from "jose";
import { getKeys } from "./keys.ts";
import { Refusal, type Claims, type User } from "./types.ts";

export const ISSUER = "http://localhost:4100";

export async function issueToken(user: User): Promise<string> {
  const keys = getKeys();
  return new SignJWT({
    preferred_username: user.username,
    name: user.name,
    realm_access: { roles: [...user.roles] },
    groups: [...user.groups],
    tideuserkey: user.tideuserkey,
  })
    .setProtectedHeader({ alg: "ES256", kid: keys.tokenPublicJwk.kid, typ: "JWT" })
    .setIssuer(ISSUER)
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(keys.tokenPrivate);
}

export async function readToken(header: string | undefined): Promise<Claims> {
  const match = /^Bearer\s+(.+)$/i.exec(header ?? "");
  if (!match) throw new Refusal(401, "Missing bearer token.");
  try {
    const { payload } = await jwtVerify(match[1], getKeys().tokenPublic, { issuer: ISSUER, algorithms: ["ES256"] });
    return payload as unknown as Claims;
  } catch {
    throw new Refusal(401, "Invalid or expired token.");
  }
}
