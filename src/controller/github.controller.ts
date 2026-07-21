import { getGithubIssues, getRepoTree } from "../services/github.service.js";
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

