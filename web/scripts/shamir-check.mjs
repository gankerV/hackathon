import assert from "node:assert/strict";
import { combineShares, splitSecret } from "../src/lib/tide/shamir.ts";

function pickThree(items) {
  const sets = [];
  for (let a = 0; a < items.length; a += 1)
    for (let b = a + 1; b < items.length; b += 1)
      for (let c = b + 1; c < items.length; c += 1) sets.push([items[a], items[b], items[c]]);
  return sets;
}

let checked = 0;
for (let round = 0; round < 50; round += 1) {
  const secret = new Uint8Array(32);
  crypto.getRandomValues(secret);
  const shares = splitSecret(secret, 5, 3);
  assert.equal(shares.length, 5);
  for (const set of pickThree(shares)) {
    assert.deepEqual(combineShares(set), secret);
    checked += 1;
  }
  assert.deepEqual(combineShares(shares), secret);
  assert.deepEqual(combineShares([shares[4], shares[0], shares[2], shares[1]]), secret);
  const two = combineShares([shares[0], shares[1]]);
  assert.notDeepEqual(two, secret);
}

const zero = new Uint8Array(32);
assert.deepEqual(combineShares(splitSecret(zero, 5, 3).slice(2)), zero);

console.log(`Shamir 3-of-5 over GF(256): ${checked} three-share combinations recovered the secret; two shares did not.`);
