import { getGithubIssues, getRepoTree, getUserRepositories } from "../services/github.service.js";
import { cloneRepo, cleanWorkspace, cleanRepoClone } from "../utils/clone.utils.js";
import type { Request, Response } from "express";

function getBranch(req: Request): string {
    if (typeof req.params.branch === "string" && req.params.branch.trim() !== "") {
        return req.params.branch;
    }
    if (typeof req.query.branch === "string" && req.query.branch.trim() !== "") {
        return req.query.branch;
    }
    return "main";
}

// Fetches public repositories for a GitHub user or logged in user
export async function fetchUserRepos(req: Request, res: Response) {
    try {
        const user = (req as any).user;
        const token = req.cookies?.accessToken || req.headers.authorization?.split(" ")[1];
        let username: string | undefined = typeof req.params.username === "string" ? req.params.username : undefined;

        // If authenticated with a GitHub OAuth token, use the /user/repos endpoint directly
        // (no username needed — the token identifies the user)
        if (!username && token && (token.startsWith("gho_") || token.startsWith("ghp_"))) {
            const repos = await getUserRepositories("", token);
            res.json(repos);
            return;
        }

        // Otherwise, resolve the GitHub login from the DB user
        if (!username && user) {
            username = user.githubLogin || (user.email ? user.email.split("@")[0] : undefined);
        }

        if (!username || typeof username !== "string") {
            res.status(400).json({ error: "GitHub username is required. Please log in via GitHub OAuth or provide a username." });
            return;
        }

        const repos = await getUserRepositories(username, token);
        res.json(repos);
    } catch (error: any) {
        console.log("Error in fetchUserRepos:", error);
        res.status(500).json({ error: "Failed to fetch user repositories", details: error.message || String(error) });
    }
}

// Fetches issues only for a repository
export async function fetchIssues(req: Request, res: Response) {
    try {
        const { owner, repo } = req.params;

        if (typeof owner !== "string" || typeof repo !== "string") {
            res.status(400).json({ error: "Missing or invalid owner/repo parameters" });
            return;
        }

        const issues = await getGithubIssues(owner, repo);
        res.json(issues);
    } catch (error: any) {
        console.log("Error in fetchIssues:", error);
        res.status(500).json({ error: "internal server error", details: error.message || String(error) });
    }
}

// Fetches only the full recursive file tree for a branch (default: main)
export async function fetchTree(req: Request, res: Response) {
    try {
        const { owner, repo } = req.params;
        const branch = getBranch(req);

        if (typeof owner !== "string" || typeof repo !== "string") {
            res.status(400).json({ error: "Missing or invalid owner/repo parameters" });
            return;
        }

        const tree = await getRepoTree(owner, repo, branch);
        res.json(tree);
    } catch (error: any) {
        console.log("Error in fetchTree:", error);
        res.status(500).json({ error: "internal server error", details: error.message || String(error) });
    }
}

// Fetches both issues and the full recursive file tree combined
export async function fetchCombined(req: Request, res: Response) {
    try {
        const { owner, repo } = req.params;
        const branch = getBranch(req);

        if (typeof owner !== "string" || typeof repo !== "string") {
            res.status(400).json({ error: "Missing or invalid owner/repo parameters" });
            return;
        }

        const [issues, tree] = await Promise.all([
            getGithubIssues(owner, repo),
            getRepoTree(owner, repo, branch)
        ]);

        res.json({
            issues,
            tree,
        });
    } catch (error: any) {
        console.log("Error in fetchCombined:", error);
        res.status(500).json({ error: "internal server error", details: error.message || String(error) });
    }
}

// Clones the repository to local workspace
export async function cloneRepoController(req: Request, res: Response) {
    try {
        const { owner, repo } = req.params;

        if (typeof owner !== "string" || typeof repo !== "string") {
            res.status(400).json({ error: "Missing or invalid owner/repo parameters" });
            return;
        }

        const repoPath = await cloneRepo(owner, repo);
        res.json({ message: "Repository cloned successfully", path: repoPath });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Failed to clone repository", details: String(error) });
    }
}

// Clears all clones in the local workspace
export async function cleanWorkspaceController(_req: Request, res: Response) {
    try {
        await cleanWorkspace();
        res.json({ message: "Workspace cleared successfully - all repository clones removed" });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Failed to clear workspace", details: String(error) });
    }
}

// Clears a specific repository clone from the local workspace
export async function cleanRepoCloneController(req: Request, res: Response) {
    try {
        const { owner, repo } = req.params;

        if (typeof owner !== "string" || typeof repo !== "string") {
            res.status(400).json({ error: "Missing or invalid owner/repo parameters" });
            return;
        }

        await cleanRepoClone(owner, repo);
        res.json({ message: `Clone for ${owner}/${repo} cleared successfully` });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: `Failed to clear clone for ${req.params.owner}/${req.params.repo}`, details: String(error) });
    }
}

