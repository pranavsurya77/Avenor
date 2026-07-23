import { getGithubIssues, getRepoTree, getRepoToken } from "./github.service.js";
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
import { applyFixes } from "../utils/applyFixes.js";
import { simpleGit } from "simple-git";
import { prisma } from "../config/prisma.js";
import type { PipelineContext } from "../context/pipeline.context.js";


export async function analyzeRepository(
    context: PipelineContext,
    owner: string,
    repo: string,
    branch = "main",
    userAnswer?: string,
    previousJobId?: string
) {
    await context.log("INFO", `[analyzeRepository] Starting analysis for repository: ${owner}/${repo} (Branch: ${branch})`);

    // 1. Retrieve the repository authentication token
    await context.log("INFO", `[analyzeRepository] Retrieving repository authentication token...`);
    const token = await getRepoToken(owner, repo);

    // 2. Fetch issues, file tree, and clone repository
    await context.log("INFO", `[analyzeRepository] Fetching GitHub issues, file tree, and cloning repository...`);
    const [issues, tree, repoPath] = await Promise.all([
        getGithubIssues(owner, repo),
        getRepoTree(owner, repo, branch),
        cloneRepo(owner, repo, token)
    ]);
    await context.log("INFO", `[analyzeRepository] Repository successfully cloned to: ${repoPath}`);

    let workingBranch = `ai-maintenance-${Date.now()}`;
    if (previousJobId) {
        try {
            const prevJob = await Job.fromId(pipelineQueue, previousJobId);
            if (prevJob?.returnvalue?.workingBranch) {
                workingBranch = prevJob.returnvalue.workingBranch;
                await context.log("INFO", `[analyzeRepository] Reusing existing working branch from previous job: ${workingBranch}`);
                console.log(`[analyzeRepository] Reusing existing working branch from previous job: ${workingBranch}`);
            }
        } catch (err) {
            await context.log("ERROR", `[analyzeRepository] Failed to fetch previous job:`, err);
            console.error(`[analyzeRepository] Failed to fetch previous job:`, err);
        }
    }

    let pullRequest: any = null;

    // Creating/checking out working branch
    await context.log("INFO", `[analyzeRepository] Setting up working branch: ${workingBranch}`);
    await setupWorkingBranch(repoPath, workingBranch);

    // 2. Ask AI agent to locate relevant files
    await context.log("INFO", `[analyzeRepository] Running file locater agent...`);
    const relevantFiles = await locateRelevantFiles(issues, tree);
    await context.log("INFO", `[analyzeRepository] File locater identified relevant files: ${relevantFiles.join(", ")}`);

    // 3. Run interactive AI agent tool loop to explore codebase on-demand & generate fix
    await context.log("INFO", `[analyzeRepository] Launching issue fix agent...`);
    const fixResult = await fixIssues({
        context,
        issue: issues,
        relevantFiles,
        repoPath,
        userAnswer
    });

    await context.log("INFO", `[analyzeRepository] Issue fix agent complete.`, fixResult);
    console.log("[analyzeRepository] Interactive fix result:", fixResult);


    //no need to do validation if user input is requried
    if (fixResult.userInputRequired) {
        await context.log("WARN", `[analyzeRepository] Issue fix agent requires user input/clarification.`);
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

    // 4. Apply the generated fixes to the repository on disk
    let patchSummary = null;
    if (fixResult.fixes && fixResult.fixes.length > 0) {
        await context.log("INFO", `[analyzeRepository] Applying ${fixResult.fixes.length} search/replace fixes to files...`);
        console.log("[analyzeRepository] Applying search/replace fixes...");
        const applyResult = await applyFixes(repoPath, fixResult.fixes);

        // Generate a syntactically correct git diff patch from the applied changes
        const git = simpleGit(repoPath);
        const diffPatch = await git.diff();
        fixResult.patch = diffPatch;

        patchSummary = {
            success: applyResult.errors.length === 0,
            appliedFiles: applyResult.modifiedFiles,
            error: applyResult.errors.join("\n") || undefined
        };
        await context.log("INFO", `[analyzeRepository] Search/replace fix application summary.`, patchSummary);
        console.log("[analyzeRepository] Search/replace fix application summary:", patchSummary);
    } else if (fixResult.patch) {
        await context.log("INFO", `[analyzeRepository] Applying git diff patch...`);
        patchSummary = await applyUnifiedDiffPatch(repoPath, fixResult.patch);
        await context.log("INFO", `[analyzeRepository] Patch application summary.`, patchSummary);
        console.log("[analyzeRepository] Patch application summary:", patchSummary);
    }

    // 5. Run repository build validation (Orchestration Layer)
    await context.log("INFO", `[analyzeRepository] Running repository build validation...`);
    console.log("[analyzeRepository] Running repository build validation...");
    const validationResult = await validateRepository(repoPath);
    await context.log("INFO", `[analyzeRepository] Validation complete: buildPassed=${validationResult.buildPassed}`);
    console.log("[analyzeRepository] Validation result:", validationResult);

    if (validationResult.buildPassed) {
        await context.log("INFO", `[analyzeRepository] Build passed. Pushing changes to remote branch...`);
        console.log("[analyzeRepository] Pushing changes to remote repository...");
        const commitMsg = issues?.[0]?.title ? `Fix: ${issues[0].title}` : "Fix: resolve repository maintenance issues";
        const pushResult = await commitAndPush(repoPath, commitMsg, workingBranch);
        if (!pushResult.success) {
            await context.log("ERROR", `[analyzeRepository] Failed to push changes: ${pushResult.error}`);
            return {
                error: `Failed to push changes: ${pushResult.error}`
            };
        }
        await context.log("INFO", `[analyzeRepository] Raising GitHub Pull Request...`);
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
            await context.log("ERROR", `[analyzeRepository] Failed to raise pull request: ${prResult.error}`);
            return {
                error: `Failed to raise pull request: ${prResult.error}`
            };
        }

        await context.log("INFO", `[analyzeRepository] Pull Request successfully raised. URL: ${prResult.pullRequest?.html_url}`);

        const dbRepo = await prisma.repository.findFirst({
            where: {
                name: repo,
                owner: {
                    githubLogin: owner
                }
            }
        });

        if (dbRepo) {
            try {
                await prisma.pullRequest.create({
                    data: {
                        title: prResult.pullRequest?.title || commitMsg,
                        description: prResult.pullRequest?.body || "",
                        status: prResult.pullRequest?.state || "OPEN",
                        repositoryId: dbRepo.id,
                        authorId: dbRepo.ownerId,
                    }
                });
                await context.log("INFO", `[analyzeRepository] Successfully logged Pull Request to database.`);
                console.log("[analyzeRepository] Successfully logged Pull Request to database.");
            } catch (dbErr: any) {
                await context.log("ERROR", `[analyzeRepository] Failed to save Pull Request to database: ${dbErr.message}`);
                console.error("[analyzeRepository] Failed to save Pull Request to database:", dbErr.message);
            }
        } else {
            await context.log("WARN", `[analyzeRepository] Repository ${owner}/${repo} not found in database. Skipping DB log.`);
            console.warn(`[analyzeRepository] Repository ${owner}/${repo} not found in database. Skipping DB log.`);
        }

        pullRequest = prResult.pullRequest;
        const prUrl = prResult.pullRequest?.html_url;
        const commentBody = prUrl
            ? `This issue has been resolved by pull request: ${prUrl}. Closing issue.`
            : "This issue has been resolved. Closing issue.";
        await context.log("INFO", `[analyzeRepository] Closing resolved issues...`);
        await closeIssues(owner, repo, issues, commentBody);
        await context.log("INFO", `[analyzeRepository] Issues closed successfully.`);
    } else {
        await context.log("WARN", `[analyzeRepository] Build failed. Launching build fix agent...`);
        const fixedResult = await fixBuildIssues(
            {
                context,
                validationResult,
                relevantFiles,
                repoPath
            }
        );

        await context.log("INFO", `[analyzeRepository] Build fix agent complete.`, fixedResult);

        if (fixedResult.userInputRequired) {
            await context.log("WARN", `[analyzeRepository] Build fix agent requires user input/clarification.`);
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

        if (fixedResult.fixes && fixedResult.fixes.length > 0) {
            await context.log("INFO", `[analyzeRepository] Applying ${fixedResult.fixes.length} build fixes...`);
            console.log("[analyzeRepository] Applying build search/replace fixes...");
            const applyResult = await applyFixes(repoPath, fixedResult.fixes);
            const git = simpleGit(repoPath);
            const diffPatch = await git.diff();
            fixedResult.patch = diffPatch;

            if (applyResult.errors.length > 0) {
                await context.log("ERROR", `[analyzeRepository] Failed to apply build fixes: ${applyResult.errors.join("; ")}`);
                return {
                    error: `Failed to apply build fixes: ${applyResult.errors.join("; ")}`
                };
            }
            await context.log("INFO", `[analyzeRepository] Build fixes applied successfully.`);
            console.log("[analyzeRepository] Build search/replace fixes applied successfully.");
        } else if (fixedResult.patch) {
            await context.log("INFO", `[analyzeRepository] Applying build patch...`);
            const buildPatchSummary = await applyUnifiedDiffPatch(repoPath, fixedResult.patch);
            if (!buildPatchSummary.success) {
                await context.log("ERROR", `[analyzeRepository] Failed to apply build patch: ${buildPatchSummary.error}`);
                return {
                    error: `Failed to apply build patch: ${buildPatchSummary.error}`
                };
            }
            await context.log("INFO", `[analyzeRepository] Build patch applied successfully.`, buildPatchSummary);
            console.log("[analyzeRepository] Build patch application summary:", buildPatchSummary);
        }

        await context.log("INFO", `[analyzeRepository] Running repository build validation after fixing build issues...`);
        console.log("[analyzeRepository] Running repository build validation after fixing build issues...");
        const revalidation = await validateRepository(repoPath);
        await context.log("INFO", `[analyzeRepository] Revalidation complete: buildPassed=${revalidation.buildPassed}`);
        console.log("[analyzeRepository] Validation result:", revalidation);

        if (revalidation.buildPassed) {
            await context.log("INFO", `[analyzeRepository] Build passed. Pushing changes to remote branch...`);
            console.log("[analyzeRepository] Pushing changes to remote repository...");
            const commitMsg = issues?.[0]?.title ? `Fix: ${issues[0].title}` : "Fix: resolve repository maintenance issues";
            const pushResult = await commitAndPush(repoPath, commitMsg, workingBranch);
            if (!pushResult.success) {
                await context.log("ERROR", `[analyzeRepository] Failed to push changes: ${pushResult.error}`);
                return {
                    error: `Failed to push changes: ${pushResult.error}`
                };
            }
            await context.log("INFO", `[analyzeRepository] Raising GitHub Pull Request...`);
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
                await context.log("ERROR", `[analyzeRepository] Failed to raise pull request: ${prResult.error}`);
                return {
                    error: `Failed to raise pull request: ${prResult.error}`
                };
            }

            await context.log("INFO", `[analyzeRepository] Pull Request successfully raised. URL: ${prResult.pullRequest?.html_url}`);

            const dbRepo = await prisma.repository.findFirst({
                where: {
                    name: repo,
                    owner: {
                        githubLogin: owner
                    }
                }
            });

            if (dbRepo) {
                try {
                    await prisma.pullRequest.create({
                        data: {
                            title: prResult.pullRequest?.title || commitMsg,
                            description: prResult.pullRequest?.body || "",
                            status: prResult.pullRequest?.state || "OPEN",
                            repositoryId: dbRepo.id,
                            authorId: dbRepo.ownerId,
                        }
                    });
                    await context.log("INFO", `[analyzeRepository] Successfully logged Pull Request (after build fixes) to database.`);
                    console.log("[analyzeRepository] Successfully logged Pull Request (after build fixes) to database.");
                } catch (dbErr: any) {
                    await context.log("ERROR", `[analyzeRepository] Failed to save Pull Request (after build fixes) to database: ${dbErr.message}`);
                    console.error("[analyzeRepository] Failed to save Pull Request (after build fixes) to database:", dbErr.message);
                }
            } else {
                await context.log("WARN", `[analyzeRepository] Repository ${owner}/${repo} not found in database. Skipping DB log.`);
                console.warn(`[analyzeRepository] Repository ${owner}/${repo} not found in database. Skipping DB log.`);
            }

            pullRequest = prResult.pullRequest;
            const prUrl = prResult.pullRequest?.html_url;
            const commentBody = prUrl
                ? `This issue has been resolved by pull request: ${prUrl}. Closing issue.`
                : "This issue has been resolved. Closing issue.";
            await context.log("INFO", `[analyzeRepository] Closing resolved issues...`);
            await closeIssues(owner, repo, issues, commentBody);
            await context.log("INFO", `[analyzeRepository] Issues closed successfully.`);
        } else {
            await context.log("ERROR", `[analyzeRepository] Build is still not fixed after build fix attempts.`);
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