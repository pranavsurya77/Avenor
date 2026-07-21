import { simpleGit } from "simple-git";
import fs from "fs/promises";
import path from "path";

export interface ApplyPatchResult {
    success: boolean;
    appliedFiles: string[];
    error?: string;
}

/**
 * Applies a standard Unified Diff (git diff) patch string to the repository on disk using git apply.
 * 
 * @param repoPath - Absolute path to the local cloned repository directory.
 * @param patchContent - Standard unified diff string (starting with --- a/ and +++ b/).
 */
export async function applyUnifiedDiffPatch(
    repoPath: string,
    patchContent: string
): Promise<ApplyPatchResult> {
    if (!patchContent || !patchContent.trim()) {
        return { success: false, appliedFiles: [], error: "Patch content is empty." };
    }

    const tempPatchPath = path.join(repoPath, ".agent_temp_fix.patch");
    const git = simpleGit(repoPath);

    try {
        await fs.writeFile(tempPatchPath, patchContent, "utf-8");

        // Extract affected relative file paths from +++ b/... headers
        const fileMatches = patchContent.matchAll(/^\+\+\+\s+b\/(.+)$/gm);
        const appliedFiles = Array.from(fileMatches, m => m[1] ? m[1].trim() : "").filter(f => Boolean(f));

        try {
            await git.raw(["apply", "--ignore-whitespace", tempPatchPath]);
            console.log(`[applyPatch] Successfully applied git patch to files:`, appliedFiles);
        } catch (gitErr: any) {
            console.warn(`[applyPatch] Standard apply failed, trying 3-way merge apply: ${gitErr.message}`);
            await git.raw(["apply", "-3", tempPatchPath]);
        }

        await fs.rm(tempPatchPath, { force: true });

        return {
            success: true,
            appliedFiles: appliedFiles.length > 0 ? appliedFiles : ["Workspace Files"]
        };
    } catch (err: any) {
        console.error(`[applyPatch] Error applying Unified Diff patch: ${err.message}`);
        await fs.rm(tempPatchPath, { force: true }).catch(() => {});
        return {
            success: false,
            appliedFiles: [],
            error: err.message
        };
    }
}
