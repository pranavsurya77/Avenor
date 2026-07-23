import { Router } from "express";
import { logOut } from "../controller/auth.controller.js";
import { githubLogin, githubCallback } from "../controller/oauth.controller.js";
import { isLoggedIn } from "../middleware/login.middleware.js";

const router = Router();

// Single Sign-On (SSO) via GitHub
router.get("/github/login", githubLogin);
router.get("/github/callback", githubCallback);
router.post("/logout", isLoggedIn, logOut);

export default router;