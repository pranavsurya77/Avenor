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

