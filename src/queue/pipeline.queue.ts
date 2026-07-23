import { Queue } from "bullmq";
import { redisConfig } from "../config/redis.config.js";
import { prisma } from "../config/prisma.js";
import { JobStatus } from "../generated/prisma/enums.js";
import { getOrCreateRepository } from "../services/repo.service.js";

export interface PipelineJobData {
    owner: string;
    repo: string;
    branch?: string | undefined;
    triggerSource?: "manual" | "webhook" | undefined;
    issueNumber?: number | undefined;
    issueTitle?: string | undefined;
    userAnswer?: string | undefined;
    previousJobId?: string | undefined;
    prismaJobId?: string | undefined;
}

export const PIPELINE_QUEUE_NAME = "pipelineQueue";

export const pipelineQueue = new Queue<PipelineJobData>(PIPELINE_QUEUE_NAME, {
    connection: redisConfig
});

export async function addPipelineJob(data: PipelineJobData) {
    const branch = data.branch || "main";
    const prefix = data.userAnswer ? "resume" : "analyze";

    let prismaJobId = data.prismaJobId;

    if (!prismaJobId) {
        const repoRecord = await getOrCreateRepository(data.owner, data.repo);
        const prismaJob = await prisma.job.create({
            data: {
                name: `${prefix}-${data.owner}-${data.repo}-${branch}`,
                status: JobStatus.RUNNING,
                repositoryId: repoRecord.id,
                startedAt: new Date()
            }
        });
        prismaJobId = prismaJob.id;
    } else {
        await prisma.job.update({
            where: { id: prismaJobId },
            data: {
                status: JobStatus.RUNNING,
                updatedAt: new Date()
            }
        });
    }

    const jobData: PipelineJobData = {
        ...data,
        prismaJobId
    };

    const jobName = `${prefix}-${data.owner}-${data.repo}-${branch}`;

    const job = await pipelineQueue.add(jobName, jobData, {
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

