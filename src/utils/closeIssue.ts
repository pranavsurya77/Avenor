import { closeIssue, createIssueComment } from "../services/github.service.js";

interface Issue {
    number: number;
}

/**
 * Closes a list of GitHub issues for a repository.
 * Optionally posts a comment on each issue before closing.
 * 
 * @param owner - Owner of the repository.
 * @param repo - Repository name.
 * @param issues - Array of issues containing issue numbers.
 * @param commentBody - Optional body of the comment to post before closing.
 * @returns Object indicating success status.
 */
export async function closeIssues(
    owner: string,
    repo: string,
    issues: Issue[],
    commentBody?: string
): Promise<{ success: boolean }> {
    // Iterate and close each issue
    for (const issue of issues) {
        try {
            // Post comment if provided
            if (commentBody) {
                console.log(`[GitHubService] Posting comment on issue #${issue.number}...`);
                await createIssueComment(owner, repo, issue.number, commentBody);
            }

            console.log(`[GitHubService] Closing issue #${issue.number}...`);
            const result = await closeIssue(owner, repo, issue.number);
            if (!result) {
                console.error(`[GitHubService] Failed to close issue #${issue.number} (returned empty response).`);
            } else {
                console.log(`[GitHubService] Successfully closed issue #${issue.number}`);
            }
        } catch (error: any) {
            console.error(`[GitHubService] Error closing issue #${issue.number}:`, error.message);
        }
    }
    return {
        success: true
    };
}