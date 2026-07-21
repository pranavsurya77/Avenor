import type { Request, Response } from "express";
import { addPipelineJob } from "../queue/pipeline.queue.js";

export async function handleGithubWebhook(req: Request, res: Response) {
    try {
        const event = req.headers["x-github-event"] as string;
        const payload = req.body;

        if (!payload || !event) {
            res.status(400).json({ error: "Missing webhook headers or payload" });
            return;
        }

        console.log(`[Webhook] Received GitHub event: '${event}'`);

        if (event === "ping") {
            res.status(200).json({ message: "pong" });
            return;
        }

        if (event === "issues") {
            const action = payload.action;
            // Process on issue creation or re-opening
            if (["opened", "reopened"].includes(action)) {
                const owner = payload.repository?.owner?.login;
                const repo = payload.repository?.name;
                const branch = payload.repository?.default_branch || "main";
                const issueNumber = payload.issue?.number;
                const issueTitle = payload.issue?.title;

                if (!owner || !repo) {
                    res.status(400).json({ error: "Invalid repository details in webhook payload" });
                    return;
                }

                const job = await addPipelineJob({
                    owner,
                    repo,
                    branch,
                    triggerSource: "webhook",
                    issueNumber,
                    issueTitle
                });

                console.log(
                    `[Webhook] Issue #${issueNumber} '${action}' in ${owner}/${repo}. Enqueued Job #${job.id}`
                );

                res.status(202).json({
                    message: "Webhook processed, pipeline job queued",
                    jobId: job.id,
                    event: `issues.${action}`,
                    repo: `${owner}/${repo}`
                });
                return;
            }
        }

        if (event === "check_run") {
            const action = payload.action;
            const checkRun = payload.check_run;

            if (action === "completed" && checkRun?.conclusion === "failure") {
                const owner = payload.repository?.owner?.login;
                const repo = payload.repository?.name;
                const branch = checkRun?.check_suite?.head_branch || "main";

                if (owner && repo) {
                    const job = await addPipelineJob({
                        owner,
                        repo,
                        branch,
                        triggerSource: "webhook"
                    });

                    console.log(
                        `[Webhook] Check run failed in ${owner}/${repo} (${branch}). Enqueued Job #${job.id}`
                    );

                    res.status(202).json({
                        message: "Check run failure webhook processed, pipeline job queued",
                        jobId: job.id,
                        event: "check_run.completed",
                        repo: `${owner}/${repo}`
                    });
                    return;
                }
            }
        }

        res.status(200).json({
            message: `Event '${event}' received, no queue action triggered.`
        });
    } catch (error) {
        console.error("Error processing GitHub webhook:", error);
        res.status(500).json({ error: "Internal Server Error processing webhook" });
    }
}
