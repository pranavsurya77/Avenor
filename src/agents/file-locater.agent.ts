import { openrouterClient, DEFAULT_MODEL } from '../config/openrouter.js';

export interface PipelinePayload {
    issues: any[];
    tree: {
        sha?: string;
        url?: string;
        tree: Array<{
            path: string;
            mode?: string;
            type: string;
            sha?: string;
            size?: number;
            url?: string;
        }>;
        truncated?: boolean;
    } | Array<{
        path: string;
        type: string;
    }>;
}

const IGNORED_EXTENSIONS = [
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp',
    '.woff', '.woff2', '.ttf', '.eot', '.lock', '.pdf', '.zip',
    '.tar', '.gz', '.jar', '.class', '.pyc', '.exe', '.dll', '.so',
    '.dylib', '.map', '.min.js', '.min.css'
];
const IGNORED_FILENAMES = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];

/**
 * Identifies the most relevant files in a repository to solve a given issue.
 */
export async function locateRelevantFiles(
    inputOrIssues: PipelinePayload | any,
    fileTreeParam?: any
): Promise<string[]> {
    let issues: any;
    let fileTree: any;

    if (fileTreeParam !== undefined) {
        issues = inputOrIssues;
        fileTree = fileTreeParam;
    } else if (inputOrIssues && (inputOrIssues.issues !== undefined || inputOrIssues.tree !== undefined)) {
        issues = inputOrIssues.issues;
        fileTree = inputOrIssues.tree;
    } else {
        issues = inputOrIssues;
        fileTree = inputOrIssues;
    }

    const treeItems = Array.isArray(fileTree) ? fileTree : (fileTree?.tree || []);
    const rawFiles = treeItems
        .filter((item: any) => item.type === 'blob')
        .map((item: any) => item.path);

    // Token Optimization: Filter out assets, binaries, maps, and lockfiles
    const files = rawFiles.filter((pathStr: string) => {
        const lower = pathStr.toLowerCase();
        const baseName = pathStr.split('/').pop() || '';
        if (IGNORED_FILENAMES.includes(baseName)) return false;
        return !IGNORED_EXTENSIONS.some(ext => lower.endsWith(ext));
    });

    console.log(`[file-locater] Filtered repository tree from ${rawFiles.length} files down to ${files.length} code files.`);

    // Format the issue details cleanly
    let issueDetails = '';
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

    const prompt = `
You are an expert software engineer.
You are given an issue (or a list of issues) and a list of files in a repository.
Your task is to identify the most relevant files that need to be examined or modified to resolve the issue(s).
Only include files that exist in the provided repository files list.

Issue Details:
${issueDetails}

Repository Files:
${files.join('\n')}

Please return a JSON object with a single key "files" containing an array of the exact file paths.
Example: { "files": ["README.md"] }
`;

    try {
        console.log(`[file-locater] Sending request to AI model (${DEFAULT_MODEL})...`);
        const response = await openrouterClient.chat.completions.create({
            model: DEFAULT_MODEL,
            messages: [
                { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.1,
        });

        let content = response.choices[0]?.message?.content || "{}";
        content = content.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(content);
        const relevantFiles = Array.isArray(parsed) ? parsed : (parsed.files || []);
        console.log("[file-locater] Identified relevant files:", relevantFiles);
        return relevantFiles;
    } catch (error) {
        console.error("Error in locateRelevantFiles:", error);
        return [];
    }
}