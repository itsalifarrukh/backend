import { Router } from "express";
import { registreUser } from "../controllers/user.controller.js";
import { uplaod } from "../middlewares/multer.middleware.js";

const router = Router();

router.route("/register").post(
   uplaod.fields([
      {
         name: "avatar",
         maxCount: 1,
      },
      {
         name: "coverImage",
         maxCount: 1,
      },
   ]),
   registreUser
);
// router.route("/login").post(loginUser);

export default router;
