import { getGithubIssues, getRepoTree } from "./github.service.js";
import { cloneRepo } from "../utils/clone.utils.js";
import { locateRelevantFiles } from "../agents/file-locater.agent.js";
import { fixIssues } from "../agents/issue-fix.agent.js";
import { applyUnifiedDiffPatch } from "../utils/applyPatch.js";
import { validateRepository } from "../validation/validateRepository.js";

export async function analyzeRepository(
    owner: string,
    repo: string,
    branch = "main",
    userAnswer?: string
) {
    // 1. Fetch issues, file tree, and clone repository
    const [issues, tree, repoPath] = await Promise.all([
        getGithubIssues(owner, repo),
        getRepoTree(owner, repo, branch),
        cloneRepo(owner, repo)
    ]);

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

    // 4. Apply the generated Unified Diff patch to the repository on disk
    let patchSummary = null;
    if (!fixResult.userInputRequired && fixResult.patch) {
        patchSummary = await applyUnifiedDiffPatch(repoPath, fixResult.patch);
        console.log("[analyzeRepository] Patch application summary:", patchSummary);
    }

    // 5. Run repository build validation (Orchestration Layer)
    console.log("[analyzeRepository] Running repository build validation...");
    const validationResult = await validateRepository(repoPath);
    console.log("[analyzeRepository] Validation result:", validationResult);

    return {
        issues,
        relevantFiles,
        fixes: fixResult,
        patchSummary,
        validation: validationResult
    };
}