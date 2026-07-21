import { Queue } from "bullmq";
import { redisConfig } from "../config/redis.config.js";

export interface PipelineJobData {
    owner: string;
    repo: string;
    branch?: string;
    triggerSource?: "manual" | "webhook";
    issueNumber?: number;
    issueTitle?: string;
    userAnswer?: string;
    previousJobId?: string;
}

export const PIPELINE_QUEUE_NAME = "pipelineQueue";

export const pipelineQueue = new Queue<PipelineJobData>(PIPELINE_QUEUE_NAME, {
    connection: redisConfig
});

export async function addPipelineJob(data: PipelineJobData) {
    const branch = data.branch || "main";
    const prefix = data.userAnswer ? "resume" : "analyze";
    const jobName = `${prefix}-${data.owner}-${data.repo}-${branch}`;

    const job = await pipelineQueue.add(jobName, data, {
        attempts: 3,
        backoff: {
            type: "exponential",
            delay: 5000
        },
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 86400, count: 1000 }
    });

    return job;
}
