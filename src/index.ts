import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import { githubRoutes } from "./routes/repo.routes.js";
import { pipelineRouter } from "./routes/pipeline.routes.js";
import { webhookRouter } from "./routes/webhook.routes.js";
import authRouter from "./routes/auth.route.js";
import { initPipelineWorker } from "./queue/pipeline.worker.js";
import { healthRouter } from "./routes/health.routes.js";
import helmet from "helmet";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(helmet());

app.use(["/auth", "/api/auth"], authRouter);
app.use("/github", githubRoutes);
app.use("/pipeline", pipelineRouter);
app.use("/webhooks", webhookRouter);
app.use("/", healthRouter);

// Global error handling middleware (handles all uncaught routing errors)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("[Global Error Handler]:", err);
    res.status(err.status || 500).json({
        error: err.message || "Internal Server Error"
    });
});

// Initialize BullMQ worker for background pipeline job processing
initPipelineWorker();

app.listen(8000, () => {
    console.log("Server is listening on port 8000");
    console.log("BullMQ Pipeline Worker initialized and waiting for jobs.");
});
