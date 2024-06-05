import { Router } from "express";
import { registreUser } from "../controllers/user.controller.js";

const router = Router();

router.route("/register").post(registreUser);
// router.route("/login").post(loginUser);

export default router;
