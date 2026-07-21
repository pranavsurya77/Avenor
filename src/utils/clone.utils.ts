import { simpleGit } from "simple-git";
import fs from "fs/promises";
import path from "path";

const git = simpleGit();

export async function cloneRepo(
    owner: string,
    repo: string
) {
    const repoPath = path.join(
        process.cwd(),
        "workspace",
        `${owner}-${repo}`
    );

    try {
        await fs.access(repoPath);
        console.log("Repo already exists");
        return repoPath;
    } catch { }

    await git.clone(
        `https://github.com/${owner}/${repo}.git`,
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
