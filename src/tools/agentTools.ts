import fs from "fs/promises";
import path from "path";
import type { ChatCompletionTool } from "openai/resources/chat/completions";

export const AGENT_TOOLS: ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: "read_file",
            description: "Read the contents of a specific file in the repository.",
            parameters: {
                type: "object",
                properties: {
                    filePath: { type: "string", description: "Relative path to the file in the repository." },
                    startLine: { type: "number", description: "Optional 1-indexed line number to start reading from." },
                    endLine: { type: "number", description: "Optional 1-indexed line number to stop reading at." }
                },
                required: ["filePath"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "read_multiple_files",
            description: "Read the contents of multiple files simultaneously in one call to save context turns and tokens.",
            parameters: {
                type: "object",
                properties: {
                    filePaths: {
                        type: "array",
                        items: { type: "string" },
                        description: "List of relative file paths in the repository."
                    }
                },
                required: ["filePaths"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "search_codebase",
            description: "Search for a string or pattern across files in the codebase.",
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string", description: "The string or pattern to search for." }
                },
                required: ["query"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "list_directory",
            description: "List files and subdirectories in a directory of the repository.",
            parameters: {
                type: "object",
                properties: {
                    dirPath: { type: "string", description: "Subdirectory path relative to repository root (use '' or '.' for root)." }
                },
                required: ["dirPath"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "find_references",
            description: "Search for references or import occurrences of a symbol, class, function, or variable.",
            parameters: {
                type: "object",
                properties: {
                    symbol: { type: "string", description: "The symbol or identifier to find references for." }
                },
                required: ["symbol"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "ask_user",
            description: "Ask the user a clarifying question when information or context is missing or ambiguous.",
            parameters: {
                type: "object",
                properties: {
                    question: { type: "string", description: "The question to ask the user." }
                },
                required: ["question"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "submit_fix",
            description: "Submit the final Unified Diff (git diff) patch and explanation resolving the issue.",
            parameters: {
                type: "object",
                properties: {
                    patch: { type: "string", description: "Standard Unified Diff patch string starting with --- a/... and +++ b/..." },
                    explanation: { type: "string", description: "Summary of the changes made and why." }
                },
                required: ["patch", "explanation"]
            }
        }
    }
];

async function getAllFiles(dir: string, baseDir: string, ignoreDirs = ["node_modules", ".git", "dist", "workspace"]): Promise<string[]> {
    let results: string[] = [];
    const list = await fs.readdir(dir, { withFileTypes: true });

    for (const file of list) {
        if (ignoreDirs.includes(file.name)) continue;
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) {
            const subFiles = await getAllFiles(fullPath, baseDir, ignoreDirs);
            results = results.concat(subFiles);
        } else {
            results.push(path.relative(baseDir, fullPath));
        }
    }
    return results;
}

export async function executeToolCall(
    name: string,
    args: any,
    repoPath: string
): Promise<string> {
    try {
        if (name === "read_file") {
            const { filePath, startLine, endLine } = args;
            const absolutePath = path.join(repoPath, filePath);
            const content = await fs.readFile(absolutePath, "utf-8");
            const lines = content.split(/\r?\n/);

            if (startLine || endLine) {
                const start = Math.max(1, startLine || 1) - 1;
                const end = Math.min(lines.length, endLine || lines.length);
                const sliced = lines.slice(start, end);
                return `=== ${filePath} (lines ${start + 1}-${end} of ${lines.length}) ===\n` + sliced.join("\n");
            }
            return `=== ${filePath} ===\n` + content;
        }

        if (name === "read_multiple_files") {
            const { filePaths } = args;
            if (!Array.isArray(filePaths) || filePaths.length === 0) {
                return "Error: filePaths array must not be empty.";
            }

            const results: string[] = [];
            for (const fp of filePaths) {
                const absolutePath = path.join(repoPath, fp);
                try {
                    const content = await fs.readFile(absolutePath, "utf-8");
                    results.push(`=== File: ${fp} ===\n${content}`);
                } catch (err: any) {
                    results.push(`=== File: ${fp} ===\n[Error reading file: ${err.message}]`);
                }
            }
            return results.join("\n\n---\n\n");
        }

        if (name === "search_codebase" || name === "find_references") {
            const query = name === "search_codebase" ? args.query : args.symbol;
            if (!query) return "Error: search query or symbol is required.";

            const allFiles = await getAllFiles(repoPath, repoPath);
            const matches: string[] = [];

            for (const relPath of allFiles) {
                try {
                    const absPath = path.join(repoPath, relPath);
                    const content = await fs.readFile(absPath, "utf-8");
                    const lines = content.split(/\r?\n/);

                    lines.forEach((line, idx) => {
                        if (line.includes(query)) {
                            matches.push(`${relPath}:${idx + 1}: ${line.trim()}`);
                        }
                    });
                } catch {}
            }

            if (matches.length === 0) {
                return `No occurrences of '${query}' found in codebase.`;
            }
            return `Search results for '${query}' (${matches.length} matches):\n` + matches.slice(0, 50).join("\n");
        }

        if (name === "list_directory") {
            const targetSub = args.dirPath || ".";
            const absoluteDir = path.join(repoPath, targetSub);
            const entries = await fs.readdir(absoluteDir, { withFileTypes: true });

            const formatted = entries.map(e => {
                const type = e.isDirectory() ? "[DIR]" : "[FILE]";
                return `${type} ${e.name}`;
            });

            return `Directory listing for '${targetSub}':\n` + formatted.join("\n");
        }

        if (name === "ask_user" || name === "submit_fix") {
            return JSON.stringify(args);
        }

        return `Unknown tool '${name}'`;
    } catch (error: any) {
        return `Error executing tool '${name}': ${error.message}`;
    }
}
