import { getGithubIssues, getRepoTree } from "./github.service.js";
import { cloneRepo } from "../utils/clone.utils.js";
import { locateRelevantFiles } from "../agents/file-locater.agent.js";
import { getFileContent } from "../utils/fileContent.js";
import { fixIssues } from "../agents/issue-fix.agent.js";
import { applyUnifiedDiffPatch } from "../utils/applyPatch.js";

export async function analyzeRepository(
    owner: string,
    repo: string,
    branch = "main"
) {
    // 1. Fetch issues, file tree, and clone repository
    const [issues, tree, repoPath] = await Promise.all([
        getGithubIssues(owner, repo),
        getRepoTree(owner, repo, branch),
        cloneRepo(owner, repo)
    ]);

    // 2. Ask AI agent to locate relevant files
    const relevantFiles = await locateRelevantFiles(issues, tree);

    // 3. Get initial contents of the relevant files
    const result = await getFileContent({
        repoPath,
        issues,
        tree,
        relevantFiles
    });

    // 4. Run interactive AI agent tool loop to explore codebase & generate fix
    const fixResult = await fixIssues({
        ...result,
        repoPath
    });

    console.log("[analyzeRepository] Interactive fix result:", fixResult);

    // 5. Apply the generated Unified Diff patch to the repository on disk
    let patchSummary = null;
    if (!fixResult.userInputRequired && fixResult.patch) {
        patchSummary = await applyUnifiedDiffPatch(repoPath, fixResult.patch);
        console.log("[analyzeRepository] Patch application summary:", patchSummary);
    }

    return {
        ...result,
        fixes: fixResult,
        patchSummary
    };
}