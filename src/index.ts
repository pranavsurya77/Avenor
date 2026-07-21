import "dotenv/config";
import express from "express";
import { githubRoutes } from "./routes/repo.routes.js";
import { pipelineRouter } from "./routes/pipeline.routes.js";
import { webhookRouter } from "./routes/webhook.routes.js";
import { initPipelineWorker } from "./queue/pipeline.worker.js";

const app = express();
app.use(express.json());

app.use("/github", githubRoutes);
app.use("/pipeline", pipelineRouter);
app.use("/webhooks", webhookRouter);

app.get("/hello", (req, res) => {
    res.send("Hello");
});

// Initialize BullMQ worker for background pipeline job processing
initPipelineWorker();

app.listen(8000, () => {
    console.log("Server is listening on port 8000");
    console.log("BullMQ Pipeline Worker initialized and waiting for jobs.");
});
