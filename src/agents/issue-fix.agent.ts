import { runInteractiveAgentLoop } from "../tools/agentRunner.js";

export interface FileContentItem {
    path: string;
    content: string;
}

export interface IssueFixInput {
    issue: any;
    relevantFiles?: string[];
    fileContents?: FileContentItem[];
    repoPath?: string;
}

export interface Replacement {
    search: string;
    replace: string;
}

export interface FileFix {
    path: string;
    explanation: string;
    replacements: Replacement[];
}

export interface FixIssuesResult {
    userInputRequired: boolean;
    question?: string | undefined;
    patch?: string | undefined;
    explanation?: string | undefined;
    fixes?: FileFix[] | undefined;
}

/**
 * Analyzes the issue and codebase interactively, then generates Unified Diff patches or requests user input.
 */
export async function fixIssues(input: IssueFixInput): Promise<FixIssuesResult> {
    // Format issues cleanly
    let issueDetails = '';
    const issues = input.issue;
    if (Array.isArray(issues)) {
        issueDetails = issues.map((i: any, index: number) => {
            const num = i.number ? `#${i.number} ` : `[Issue ${index + 1}] `;
            const title = i.title || 'No Title';
            const body = i.body || 'No Body';
            return `${num}${title}\nBody: ${body}`;
        }).join('\n\n---\n\n');
    } else if (issues && typeof issues === 'object') {
        const title = issues.title || 'No Title';
        const body = issues.body || 'No Body';
        issueDetails = `Title: ${title}\nBody: ${body}`;
    } else {
        issueDetails = String(issues || '');
    }

    const systemPrompt = `
You are an expert AI software maintenance engineer.
Your goal is to solve reported issues by exploring the codebase and producing clean code fixes.

Available Tools:
1. 'read_file': Read line ranges or full content of a file.
2. 'read_multiple_files': Read contents of multiple files in a single call (saves tokens & turns).
3. 'search_codebase': Search for text/regex across codebase files.
4. 'list_directory': Explore subdirectories.
5. 'find_references': Search for usages or imports of a symbol/function/class.
6. 'ask_user': Ask the user a question if context is ambiguous or decisions are needed.
7. 'submit_fix': Submit your final Unified Diff (git diff) patch and explanation.

Instructions:
- Use 'read_multiple_files' when inspecting multiple files to conserve turns and tokens.
- Explore import chains and relevant files to verify your solution.
- Output your patch using standard Unified Diff format (--- a/filePath ... +++ b/filePath).
- If information is insufficient or user guidance is required, call 'ask_user'.
`;

    const userPrompt = `
Issue to fix:
${issueDetails}

${input.relevantFiles ? `Initially identified relevant files: ${input.relevantFiles.join(', ')}` : ''}

Use your tools to inspect the codebase and solve this issue. When ready, invoke submit_fix or ask_user.
`;

    if (input.repoPath) {
        console.log("[issue-fix] Launching interactive tool loop...");
        const loopResult = await runInteractiveAgentLoop(
            systemPrompt,
            userPrompt,
            input.repoPath,
            10
        );

        if (loopResult.type === "ask_user") {
            return {
                userInputRequired: true,
                question: loopResult.question || "User clarification requested."
            };
        }

        if (loopResult.type === "submit_fix") {
            return {
                userInputRequired: false,
                patch: loopResult.patch || "",
                explanation: loopResult.explanation || ""
            };
        }

        return {
            userInputRequired: true,
            question: loopResult.question || "Interactive loop reached max iterations without submitting a fix."
        };
    }

    // Fallback if no repoPath provided
    return {
        userInputRequired: true,
        question: "repoPath is required to run the interactive agent tools."
    };
}