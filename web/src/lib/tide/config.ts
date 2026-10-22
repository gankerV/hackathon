export const TIDE_URL = (process.env.NEXT_PUBLIC_TIDE_URL ?? "http://localhost:4100").replace(/\/$/, "");
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
export const NODE_COUNT = 5;
export const NODE_THRESHOLD = 3;
export const ADMIN_THRESHOLD = 3;
export const SHARE_INFO = "exam-vault-share:";
