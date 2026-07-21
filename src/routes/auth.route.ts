import { Router } from "express";
import { signUp, signIn, logOut } from "../controller/auth.controller.js";
import { githubLogin, githubCallback } from "../controller/oauth.controller.js";
import { isLoggedIn } from "../middleware/login.middleware.js";

const router = Router();

router.post("/sign-up", signUp);
router.post("/sign-in", signIn);
router.post("/logout", isLoggedIn, logOut);

router.get("/github/login", githubLogin);
router.get("/github/callback", githubCallback);

export default router;