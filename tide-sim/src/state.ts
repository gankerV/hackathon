import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { randomHex } from "./bytes.ts";
import { createKeys, createNode, loadKeys } from "./keys.ts";
import type { State, User } from "./types.ts";

const dataFolder = fileURLToPath(new URL("../data/", import.meta.url));
const stateFile = dataFolder + "state.json";

export const NODE_COUNT = 5;
export const NODE_THRESHOLD = 3;
export const ADMIN_THRESHOLD = 3;

const demoUsers: Omit<User, "id" | "tideuserkey">[] = [
  { username: "admin.an", name: "An Nguyen", roles: ["admin"], groups: [] },
  { username: "admin.binh", name: "Binh Tran", roles: ["admin"], groups: [] },
  { username: "admin.chi", name: "Chi Le", roles: ["admin"], groups: [] },
  { username: "admin.dung", name: "Dung Pham", roles: ["admin"], groups: [] },
  { username: "teacher.lan", name: "Lan Vo", roles: ["teacher", "_tide_encryptor", "_tide_decryptor"], groups: ["/teachers"] },
  { username: "student.minh", name: "Minh Ho", roles: ["student", "_tide_decryptor"], groups: ["/class-10a"] },
  { username: "student.hoa", name: "Hoa Dang", roles: ["student", "_tide_decryptor"], groups: ["/class-10a"] },
  { username: "student.khoa", name: "Khoa Bui", roles: ["student", "_tide_decryptor"], groups: ["/class-10b"] },
];

let state: State | null = null;

export function getState(): State {
  if (!state) throw new Error("State is not loaded.");
  return state;
}

export function saveState(): void {
  mkdirSync(dataFolder, { recursive: true });
  writeFileSync(stateFile, JSON.stringify(getState(), null, 2));
}

async function createState(): Promise<State> {
  const nodes = [];
  for (let id = 1; id <= NODE_COUNT; id++) nodes.push(await createNode(id));
  return {
    users: demoUsers.map((user) => ({ ...user, id: "u_" + randomHex(8), tideuserkey: randomHex(32) })),
    keys: await createKeys(),
    nodes,
    changeRequests: [],
  };
}

export async function startState(): Promise<void> {
  if (existsSync(stateFile)) {
    state = JSON.parse(readFileSync(stateFile, "utf8")) as State;
  } else {
    state = await createState();
    saveState();
  }
  await loadKeys(state.keys, state.nodes);
}

export function findUser(username: string): User | undefined {
  return getState().users.find((user) => user.username === username);
}

export function findNode(id: number) {
  return getState().nodes.find((node) => node.id === id);
}
