import type { Request, Response } from "express";
import { Job } from "bullmq";
import { addPipelineJob, pipelineQueue } from "../queue/pipeline.queue.js";

interface RepoParams {
    owner: string;
    repo: string;
    branch?: string;
}

interface JobParams {
    jobId: string;
}

export async function executePipeline(
    req: Request<RepoParams>,
    res: Response
) {
    try {
        const { owner, repo, branch } = req.params;

        const job = await addPipelineJob({
            owner,
            repo,
            branch: branch || "main",
            triggerSource: "manual"
        });

        res.status(202).json({
            message: "Pipeline analysis job queued successfully",
            jobId: job.id,
            statusUrl: `/pipeline/jobs/${job.id}`,
            data: {
                owner,
                repo,
                branch: branch || "main"
            }
        });
    } catch (error) {
        console.error("Error enqueuing pipeline job:", error);
        res.status(500).json({ error: "Failed to queue pipeline job" });
    }
}

export async function getJobStatus(
    req: Request<JobParams>,
    res: Response
) {
    try {
        const { jobId } = req.params;
        const job = await Job.fromId(pipelineQueue, jobId);

        if (!job) {
            res.status(404).json({ error: `Job with ID '${jobId}' not found.` });
            return;
        }

        const state = await job.getState();

        res.json({
            jobId: job.id,
            state,
            progress: job.progress,
            data: job.data,
            result: state === "completed" ? job.returnvalue : null,
            failedReason: state === "failed" ? job.failedReason : null,
            timestamp: job.timestamp,
            finishedOn: job.finishedOn
        });
    } catch (error) {
        console.error("Error fetching job status:", error);
        res.status(500).json({ error: "Failed to fetch job status" });
    }
}

export async function replyToJob(
    req: Request<JobParams>,
    res: Response
) {
    try {
        const { jobId } = req.params;
        const { answer } = req.body;

        if (!answer || typeof answer !== "string" || !answer.trim()) {
            res.status(400).json({ error: "Property 'answer' string is required in JSON body." });
            return;
        }

        const previousJob = await Job.fromId(pipelineQueue, jobId);
        if (!previousJob) {
            res.status(404).json({ error: `Previous job with ID '${jobId}' not found.` });
            return;
        }

        const { owner, repo, branch, issueNumber, issueTitle } = previousJob.data;

        const newJob = await addPipelineJob({
            owner,
            repo,
            branch: branch || "main",
            triggerSource: "manual",
            issueNumber,
            issueTitle,
            userAnswer: answer.trim(),
            previousJobId: jobId
        });

        console.log(`[Controller] User replied to Job #${jobId}. Enqueued resume Job #${newJob.id}`);

        res.status(202).json({
            message: "User response received, pipeline resumed",
            jobId: newJob.id,
            statusUrl: `/pipeline/jobs/${newJob.id}`,
            previousJobId: jobId,
            data: {
                owner,
                repo,
                branch: branch || "main",
                userAnswer: answer.trim()
            }
        });
    } catch (error) {
        console.error("Error processing user reply to job:", error);
        res.status(500).json({ error: "Failed to process reply and resume pipeline job" });
    }
}
