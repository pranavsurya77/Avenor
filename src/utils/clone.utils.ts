import { simpleGit } from "simple-git";
import fs from "fs/promises";
import path from "path";

const git = simpleGit();

export async function cloneRepo(
    owner: string,
    repo: string,
    token?: string | null
) {
    const repoPath = path.join(
        process.cwd(),
        "workspace",
        `${owner}-${repo}`
    );

    const cloneUrl = token
        ? `https://x-access-token:${token}@github.com/${owner}/${repo}.git`
        : `https://github.com/${owner}/${repo}.git`;

    try {
        await fs.access(repoPath);
        console.log("Repo already exists, updating remote URL with token if provided");
        if (token) {
            const localGit = simpleGit(repoPath);
            await localGit.remote(["set-url", "origin", cloneUrl]);
        }
        return repoPath;
    } catch { }

    await git.clone(
        cloneUrl,
        repoPath
    );

    return repoPath;
}

export async function cleanWorkspace() {
    const workspacePath = path.join(process.cwd(), "workspace");
    await fs.rm(workspacePath, { recursive: true, force: true });
    await fs.mkdir(workspacePath, { recursive: true });
    console.log("Workspace cleared successfully");
}

export async function cleanRepoClone(owner: string, repo: string) {
    const repoPath = path.join(process.cwd(), "workspace", `${owner}-${repo}`);
    await fs.rm(repoPath, { recursive: true, force: true });
    console.log(`Cleaned clone for ${owner}/${repo}`);
}
