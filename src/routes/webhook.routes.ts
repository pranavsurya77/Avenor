import { Router } from "express";
import { handleGithubWebhook } from "../controller/webhook.controller.js";

const router = Router();

// Endpoint for receiving GitHub webhooks
router.post("/github", handleGithubWebhook);

export { router as webhookRouter };
