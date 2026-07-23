import { Worker, Job } from "bullmq";
import { redisConfig } from "../config/redis.config.js";
import { PIPELINE_QUEUE_NAME, type PipelineJobData } from "./pipeline.queue.js";
import { analyzeRepository } from "../services/pipeline.service.js";
import { prisma } from "../config/prisma.js";
import { JobStatus } from "../generated/prisma/enums.js";
import type { PipelineContext } from "../context/pipeline.context.js";
import { logJobEvent } from "../utils/log.js";

export let pipelineWorker: Worker<PipelineJobData> | null = null;

export function initPipelineWorker() {
    if (pipelineWorker) return pipelineWorker;

    pipelineWorker = new Worker<PipelineJobData>(
        PIPELINE_QUEUE_NAME,
        async (job: Job<PipelineJobData>) => {
            const { owner, repo, branch, userAnswer, prismaJobId, previousJobId } = job.data;

            //passing down this context to other files to save to log table
            const context: PipelineContext = {
                prismaJobId: prismaJobId || "",
                bullJobId: String(job.id),

                log: async (level, message, metadata) => {
                    if (prismaJobId) {
                        await logJobEvent(
                            prismaJobId,
                            level,
                            message,
                            metadata
                        ).catch((err) => {
                            console.error(`[Worker] Failed to write log event to database:`, err);
                        });
                    }
                }
            };

            console.log(
                `[Worker] Processing Job #${job.id} (Prisma Job ID: ${prismaJobId || "N/A"}): ${owner}/${repo} (Branch: ${branch || "main"})${userAnswer ? " [Resuming with User Answer]" : ""}`
            );
            await job.updateProgress(10);

            if (prismaJobId) {
                await prisma.job.update({
                    where: { id: prismaJobId },
                    data: { status: JobStatus.RUNNING, updatedAt: new Date() }
                }).catch((err) => console.error(`[Worker] Failed to update Prisma Job #${prismaJobId} status to RUNNING:`, err));
            }

            try {
                const result = await analyzeRepository(
                    context,
                    owner,
                    repo,
                    branch || "main",
                    userAnswer,
                    previousJobId
                );

                await job.updateProgress(100);

                if (result?.error) {
                    if (prismaJobId) {
                        await prisma.job.update({
                            where: { id: prismaJobId },
                            data: {
                                status: JobStatus.FAILED,
                                completedAt: new Date(),
                                updatedAt: new Date()
                            }
                        }).catch((err) => console.error(`[Worker] Failed to update Prisma Job #${prismaJobId} status to FAILED:`, err));
                    }
                    console.error(
                        `[Worker] Job #${job.id} failed: ${result.error}`
                    );
                } else if (result?.fixes?.userInputRequired) {
                    if (prismaJobId) {
                        await prisma.job.update({
                            where: { id: prismaJobId },
                            data: {
                                status: JobStatus.WAITING_FOR_USER,
                                updatedAt: new Date()
                            }
                        });
                    }
                    console.log(
                        `[Worker] Agent called 'ask_user'. BullMQ Job #${job.id} finished. Prisma Job #${prismaJobId} updated to WAITING_FOR_USER.`
                    );
                } else {
                    if (prismaJobId) {
                        await prisma.job.update({
                            where: { id: prismaJobId },
                            data: {
                                status: JobStatus.COMPLETED,
                                completedAt: new Date(),
                                updatedAt: new Date()
                            }
                        });
                    }
                    console.log(
                        `[Worker] Analysis and fix completed. BullMQ Job #${job.id} finished. Prisma Job #${prismaJobId} updated to COMPLETED.`
                    );
                }

                return result;
            } catch (error) {
                if (prismaJobId) {
                    await prisma.job.update({
                        where: { id: prismaJobId },
                        data: {
                            status: JobStatus.FAILED,
                            completedAt: new Date(),
                            updatedAt: new Date()
                        }
                    }).catch((err) => console.error(`[Worker] Failed to update Prisma Job #${prismaJobId} status to FAILED:`, err));
                }
                throw error;
            }
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

