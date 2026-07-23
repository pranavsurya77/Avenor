import { getGithubIssues, getRepoTree } from "./github.service.js";
import { cloneRepo } from "../utils/clone.utils.js";
import { locateRelevantFiles } from "../agents/file-locater.agent.js";
import { fixIssues } from "../agents/issue-fix.agent.js";
import { applyUnifiedDiffPatch } from "../utils/applyPatch.js";
import { validateRepository } from "../validation/validateRepository.js";
import { fixBuildIssues } from "../agents/build-fix.agent.js";
import { setupWorkingBranch } from "../utils/git.utils.js";
import { Job } from "bullmq";
import { pipelineQueue } from "../queue/pipeline.queue.js";
import { commitAndPush, createPR } from "../utils/pullrequest.js";
import { closeIssues } from "../utils/closeIssue.js";


export async function analyzeRepository(
    owner: string,
    repo: string,
    branch = "main",
    userAnswer?: string,
    previousJobId?: string
) {
    // 1. Fetch issues, file tree, and clone repository
    const [issues, tree, repoPath] = await Promise.all([
        getGithubIssues(owner, repo),
        getRepoTree(owner, repo, branch),
        cloneRepo(owner, repo)
    ]);

    let workingBranch = `ai-maintenance-${Date.now()}`;
    if (previousJobId) {
        try {
            const prevJob = await Job.fromId(pipelineQueue, previousJobId);
            if (prevJob?.returnvalue?.workingBranch) {
                workingBranch = prevJob.returnvalue.workingBranch;
                console.log(`[analyzeRepository] Reusing existing working branch from previous job: ${workingBranch}`);
            }
        } catch (err) {
            console.error(`[analyzeRepository] Failed to fetch previous job:`, err);
        }
    }

    let pullRequest: any = null;

    // Creating/checking out working branch
    await setupWorkingBranch(repoPath, workingBranch);

    // 2. Ask AI agent to locate relevant files
    const relevantFiles = await locateRelevantFiles(issues, tree);

    // 3. Run interactive AI agent tool loop to explore codebase on-demand & generate fix
    const fixResult = await fixIssues({
        issue: issues,
        relevantFiles,
        repoPath,
        userAnswer
    });

    console.log("[analyzeRepository] Interactive fix result:", fixResult);


    //no need to do validation if user input is requried
    if (fixResult.userInputRequired) {
        return {
            workingBranch,
            issues,
            relevantFiles,
            fixes: fixResult,
            patchSummary: null,
            validation: null,
            pullRequest: null
        }
    }

    // 4. Apply the generated Unified Diff patch to the repository on disk
    let patchSummary = null;
    if (fixResult.patch) {
        patchSummary = await applyUnifiedDiffPatch(repoPath, fixResult.patch);
        console.log("[analyzeRepository] Patch application summary:", patchSummary);
    }

    // 5. Run repository build validation (Orchestration Layer)
    console.log("[analyzeRepository] Running repository build validation...");
    const validationResult = await validateRepository(repoPath);
    console.log("[analyzeRepository] Validation result:", validationResult);

    if (validationResult.buildPassed) {
        console.log("[analyzeRepository] Pushing changes to remote repository...");
        const commitMsg = issues?.[0]?.title ? `Fix: ${issues[0].title}` : "Fix: resolve repository maintenance issues";
        const pushResult = await commitAndPush(repoPath, commitMsg, workingBranch);
        if (!pushResult.success) {
            return {
                error: `Failed to push changes: ${pushResult.error}`
            };
        }
        console.log("[analyzeRepository] Raising pull request...");
        const prResult = await createPR(
            owner,
            repo,
            commitMsg,
            `Auto-generated fix for issue: ${commitMsg}\n\nBuild status: PASSED`,
            workingBranch,
            branch
        );
        if (!prResult.success) {
            return {
                error: `Failed to raise pull request: ${prResult.error}`
            };
        }
        pullRequest = prResult.pullRequest;
        const prUrl = prResult.pullRequest?.html_url;
        const commentBody = prUrl
            ? `This issue has been resolved by pull request: ${prUrl}. Closing issue.`
            : "This issue has been resolved. Closing issue.";
        await closeIssues(owner, repo, issues, commentBody);
    } else {
        const fixedResult = await fixBuildIssues(
            {
                validationResult,
                relevantFiles,
                repoPath
            }
        );

        if (fixedResult.userInputRequired) {
            return {
                stage: "build_fix",
                workingBranch,
                issues,
                relevantFiles,
                fixes: {
                    ...fixResult,
                    userInputRequired: true
                },
                buildFix: fixedResult,
                patchSummary,
                validation: validationResult
            };
        }

        if (fixedResult.patch) {
            const buildPatchSummary = await applyUnifiedDiffPatch(repoPath, fixedResult.patch);
            if (!buildPatchSummary.success) {
                return {
                    error: "Failed to apply build patch"
                };
            }
            console.log("[analyzeRepository] Build patch application summary:", buildPatchSummary);
        }

        console.log("[analyzeRepository] Running repository build validation after fixing build issues...");
        const revalidation = await validateRepository(repoPath);
        console.log("[analyzeRepository] Validation result:", revalidation);

        if (revalidation.buildPassed) {
            console.log("[analyzeRepository] Pushing changes to remote repository...");
            const commitMsg = issues?.[0]?.title ? `Fix: ${issues[0].title}` : "Fix: resolve repository maintenance issues";
            const pushResult = await commitAndPush(repoPath, commitMsg, workingBranch);
            if (!pushResult.success) {
                return {
                    error: `Failed to push changes: ${pushResult.error}`
                };
            }
            console.log("[analyzeRepository] Raising pull request...");
            const prResult = await createPR(
                owner,
                repo,
                commitMsg,
                `Auto-generated fix for issue: ${commitMsg}\n\nBuild status: PASSED (after build fixes)`,
                workingBranch,
                branch
            );
            if (!prResult.success) {
                return {
                    error: `Failed to raise pull request: ${prResult.error}`
                };
            }
            pullRequest = prResult.pullRequest;
            const prUrl = prResult.pullRequest?.html_url;
            const commentBody = prUrl
                ? `This issue has been resolved by pull request: ${prUrl}. Closing issue.`
                : "This issue has been resolved. Closing issue.";
            await closeIssues(owner, repo, issues, commentBody);
        } else {
            console.log("Build still not fixed");
        }

        return {
            workingBranch,
            issues,
            relevantFiles,
            fixes: fixResult,
            buildFix: fixedResult,
            patchSummary,
            validation: revalidation,
            pullRequest
        };
    }


    return {
        workingBranch,
        issues,
        relevantFiles,
        fixes: fixResult,
        patchSummary,
        validation: validationResult,
        pullRequest
    };
}