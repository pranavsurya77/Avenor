import { Worker, Job } from "bullmq";
import { redisConfig } from "../config/redis.config.js";
import { PIPELINE_QUEUE_NAME, type PipelineJobData } from "./pipeline.queue.js";
import { analyzeRepository } from "../services/pipeline.service.js";

export let pipelineWorker: Worker<PipelineJobData> | null = null;

export function initPipelineWorker() {
    if (pipelineWorker) return pipelineWorker;

    pipelineWorker = new Worker<PipelineJobData>(
        PIPELINE_QUEUE_NAME,
        async (job: Job<PipelineJobData>) => {
            console.log(
                `[Worker] Processing Job #${job.id}: ${job.data.owner}/${job.data.repo} (Branch: ${job.data.branch || "main"})`
            );
            await job.updateProgress(10);

            const result = await analyzeRepository(
                job.data.owner,
                job.data.repo,
                job.data.branch || "main"
            );

            await job.updateProgress(100);
            console.log(`[Worker] Successfully completed Job #${job.id}`);
            return result;
        },
        {
            connection: redisConfig,
            concurrency: 2
        }
    );

    pipelineWorker.on("completed", (job) => {
        console.log(`[Worker Event] Job #${job.id} completed.`);
    });

    pipelineWorker.on("failed", (job, err) => {
        console.error(`[Worker Event] Job #${job?.id} failed: ${err.message}`);
    });

    return pipelineWorker;
}
