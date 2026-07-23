import { simpleGit } from "simple-git";

export interface CommitAndPushResult {
    success: boolean;
    error?: string;
}

/**
 * Stages all changes, commits with a message, and pushes to the remote repository.
 * Returns a structured result instead of throwing unhandled exceptions.
 * 
 * @param repoPath - Absolute path to the local repository.
 * @param commitMessage - The commit message.
 * @param workingBranch - The name of the remote branch to push to.
 * @param remote - The remote name (default: "origin").
 */
export async function commitAndPush(
    repoPath: string,
    commitMessage: string,
    workingBranch: string,
    remote: string = "origin"
): Promise<CommitAndPushResult> {
    const git = simpleGit(repoPath);

    try {
        await git.add(".");
        const status = await git.status();

        if (status.files.length === 0) {
            return { success: false, error: "No changes to commit" };
        }

        await git.commit(commitMessage);
        await git.push(remote, workingBranch);

        return { success: true };
    } catch (error: any) {
        console.error(`[GitUtils] commitAndPush error:`, error.message);
        return { success: false, error: error.message };
    }
}

import { createPullRequest } from "../services/github.service.js";

export interface CreatePRResult {
    success: boolean;
    pullRequest?: any;
    error?: string;
}

/**
 * Creates a Pull Request on GitHub.
 */
export async function createPR(
    owner: string,
    repo: string,
    title: string,
    body: string,
    head: string,
    base: string
): Promise<CreatePRResult> {
    try {
        const pr = await createPullRequest(owner, repo, title, body, head, base);
        return { success: true, pullRequest: pr };
    } catch (error: any) {
        console.error(`[GitUtils] createPR error:`, error.message);
        return { success: false, error: error.message };
    }
}