import { Router } from "express";
import { currentUser } from "../auth";

export const meRoutes = Router();

meRoutes.get("/", (req, res) => {
  res.json(currentUser(res).claims);
});
