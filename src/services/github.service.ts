import { githubApp } from "../config/github.js";

// Helper to get an authenticated octokit instance for a specific repository
async function getOctokitForRepo(owner: string, repo: string) {
    try {
        // Fetch the installation ID for this specific repository
        const appOctokit = githubApp.octokit;
        const { data: installation } = await appOctokit.request("GET /repos/{owner}/{repo}/installation", {
            owner,
            repo,
        });

        // Return a new octokit client authenticated specifically for this installation
        return await githubApp.getInstallationOctokit(installation.id);
    } catch (error: any) {
        if (error.status === 404) {
            throw new Error(`GitHub App is not installed on repository '${owner}/${repo}'. Please install the GitHub App on this repository.`);
        }
        throw error;
    }
}

export async function getGithubIssues(owner: string, repo: string) {
    const octokit = await getOctokitForRepo(owner, repo);
    const response = await octokit.request("GET /repos/{owner}/{repo}/issues", {
        owner,
        repo,
    });
    return response.data;
}

// Fetches the full recursive file tree for a branch
export async function getRepoTree(owner: string, repo: string, branch = "main") {
    const octokit = await getOctokitForRepo(owner, repo);
    try {
        const response = await octokit.request("GET /repos/{owner}/{repo}/git/trees/{tree_sha}", {
            owner,
            repo,
            tree_sha: branch,
            recursive: "1",
        });
        return response.data;
    } catch (error: any) {
        // Fallback: If 'main' branch was requested but failed (404), try fetching repo default_branch or 'master'
        if (branch === "main") {
            try {
                console.log(`[getRepoTree] Branch 'main' not found for ${owner}/${repo}. Trying 'master'...`);
                const response = await octokit.request("GET /repos/{owner}/{repo}/git/trees/{tree_sha}", {
                    owner,
                    repo,
                    tree_sha: "master",
                    recursive: "1",
                });
                return response.data;
            } catch (fallbackError) {
                // Fetch actual default branch from GitHub repo details
                const { data: repoInfo } = await octokit.request("GET /repos/{owner}/{repo}", { owner, repo });
                if (repoInfo.default_branch && repoInfo.default_branch !== "main" && repoInfo.default_branch !== "master") {
                    const response = await octokit.request("GET /repos/{owner}/{repo}/git/trees/{tree_sha}", {
                        owner,
                        repo,
                        tree_sha: repoInfo.default_branch,
                        recursive: "1",
                    });
                    return response.data;
                }
            }
        }
        throw error;
    }
}

import axios from "axios";

// Fetches repositories for a given GitHub username or authenticated user
export async function getUserRepositories(username: string, token?: string) {
    const cleanUsername = username.trim();
    const headers: Record<string, string> = {
        Accept: "application/vnd.github+json",
        "User-Agent": "Avenor-App"
    };

    if (token && (token.startsWith("gho_") || token.startsWith("ghp_"))) {
        headers["Authorization"] = `Bearer ${token}`;
    } else if (process.env.GITHUB_PAT) {
        headers["Authorization"] = `Bearer ${process.env.GITHUB_PAT}`;
    }

    try {
        const isUserToken = Boolean(token && (token.startsWith("gho_") || token.startsWith("ghp_")));
        const url = isUserToken
            ? "https://api.github.com/user/repos?sort=updated&per_page=100"
            : `https://api.github.com/users/${encodeURIComponent(cleanUsername)}/repos?sort=updated&per_page=100`;

        const response = await axios.get(url, { headers });
        return response.data.map((r: any) => ({
            id: r.id,
            name: r.name,
            full_name: r.full_name,
            owner: r.owner.login,
            private: r.private,
            default_branch: r.default_branch,
            html_url: r.html_url,
            description: r.description
        }));
    } catch (error: any) {
        console.error(`Error fetching repositories for user '${username}':`, error.response?.data || error.message);
        throw new Error(error.response?.data?.message || error.message);
    }
}

export async function createPullRequest(
    owner: string,
    repo: string,
    title: string,
    body: string,
    head: string,
    base: string
) {
    const octokit = await getOctokitForRepo(owner, repo);
    const response = await octokit.request("POST /repos/{owner}/{repo}/pulls", {
        owner,
        repo,
        title,
        body,
        head,
        base,
    });
    return response.data;
}


export async function closeIssue(
    owner: string,
    repo: string,
    issueNumber: number
) {
    const octokit = await getOctokitForRepo(owner, repo);
    const response = await octokit.request("PATCH /repos/{owner}/{repo}/issues/{issue_number}", {
        owner,
        repo,
        issue_number: issueNumber,
        state: "closed",
    });
    return response.data;
}

export async function createIssueComment(
    owner: string,
    repo: string,
    issueNumber: number,
    body: string
) {
    const octokit = await getOctokitForRepo(owner, repo);
    const response = await octokit.request("POST /repos/{owner}/{repo}/issues/{issue_number}/comments", {
        owner,
        repo,
        issue_number: issueNumber,
        body,
    });
    return response.data;
}

export async function getRepoToken(owner: string, repo: string): Promise<string | null> {
    try {
        const octokit = await getOctokitForRepo(owner, repo);
        const authData = await octokit.auth({ type: "installation" }) as any;
        return authData?.token || null;
    } catch (error: any) {
        console.warn(`[getRepoToken] Failed to get GitHub App installation token: ${error.message}. Falling back to GITHUB_PAT.`);
        return process.env.GITHUB_PAT || null;
    }
}

