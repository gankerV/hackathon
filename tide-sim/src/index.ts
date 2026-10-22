import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { adminRoutes } from "./routes/admin.ts";
import { orkRoutes } from "./routes/ork.ts";
import { publicRoutes } from "./routes/public.ts";
import { startState } from "./state.ts";
import { Refusal } from "./types.ts";

const PORT = 4100;

await startState();

const app = express();
app.use(cors({ origin: "http://localhost:3000", allowedHeaders: ["Content-Type", "Authorization"] }));
app.use(express.json({ limit: "1mb" }));
app.use(publicRoutes);
app.use(adminRoutes);
app.use(orkRoutes);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found." });
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof Refusal) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  if (error instanceof SyntaxError) {
    res.status(400).json({ error: "Invalid JSON body." });
    return;
  }
  console.error(error);
  res.status(500).json({ error: "Internal error." });
});

app.listen(PORT, () => {
  console.log(`tide-sim listening on http://localhost:${PORT}`);
});
