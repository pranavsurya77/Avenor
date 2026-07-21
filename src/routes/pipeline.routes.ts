import { Router } from "express";
import { executePipeline, getJobStatus } from "../controller/pipeline.controller.js";

const router = Router();

// Queue repository analysis pipeline (default branch: main)
router.route("/repos/:owner/:repo/start").get(executePipeline).post(executePipeline);
router.route("/repos/:owner/:repo/start/:branch").get(executePipeline).post(executePipeline);

// Get status and output of a queued job
router.route("/jobs/:jobId").get(getJobStatus);

export { router as pipelineRouter };
