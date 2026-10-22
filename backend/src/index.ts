import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import { requireUser } from "./auth";
import { tideUrl } from "./tide";
import { meRoutes } from "./routes/me";
import { classRoutes } from "./routes/classes";
import { slotRoutes } from "./routes/slots";
import { policyRoutes } from "./routes/policies";
import { examRoutes } from "./routes/exams";
import { auditRoutes } from "./routes/audit";

const port = Number(process.env.PORT ?? 4000);
const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";

const app = express();

app.use(
  cors({
    origin: webOrigin,
    methods: ["GET", "POST", "PUT", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json({ limit: "10mb" }));

app.get("/api/time", (req, res) => {
  res.json({ now: new Date().toISOString() });
});

app.use("/api", requireUser);
app.use("/api/me", meRoutes);
app.use("/api/classes", classRoutes);
app.use("/api/slots", slotRoutes);
app.use("/api/policies", policyRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/audit", auditRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
  const status = (error as { status?: number }).status ?? 500;
  if (status >= 500) console.error(error);
  res.status(status).json({ error: status >= 500 ? "Server error" : (error as Error).message });
});

app.listen(port, () => {
  console.log(`backend listening on http://localhost:${port} (tide-sim: ${tideUrl})`);
});
