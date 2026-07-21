import fs from "fs";
import path from "path";

export interface InputWithRelevantFiles {
    repoPath: string;
    issue?: any;
    issues?: any;
    tree?: {
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
    relevantFiles: string[];
}

export interface FileContentItem {
    path: string;
    content: string;
}

export interface OutputWithFileContent {
    issue: any;
    relevantFiles: string[];
    fileContents: FileContentItem[];
}

const BINARY_EXTENSIONS = new Set([
    ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".webp",
    ".pdf", ".zip", ".tar", ".gz", ".7z", ".rar",
    ".exe", ".dll", ".so", ".dylib", ".bin",
    ".woff", ".woff2", ".ttf", ".eot", ".otf",
    ".mp3", ".mp4", ".wav", ".avi", ".mov"
]);

/**
 * Reads the actual text contents of the relevant files from the cloned repository.
 * Skips binary files to avoid inflating token counts.
 * 
 * @param input - Contains repoPath, issue(s), and list of relevant file paths.
 * @returns Object containing issue, relevantFiles, and fileContents (path & text content for each file).
 */
export const getFileContent = async function (
    input: InputWithRelevantFiles
): Promise<OutputWithFileContent> {
    try {
        const fileContents: FileContentItem[] = [];
        const files = input.relevantFiles || [];

        for (const fileItem of files) {
            const relativePath = typeof fileItem === "string" ? fileItem : (fileItem as any).path;
            if (!relativePath) continue;

            const ext = path.extname(relativePath).toLowerCase();
            if (BINARY_EXTENSIONS.has(ext)) {
                console.log(`[getFileContent] Skipping binary file: ${relativePath}`);
                continue;
            }

            const fullPath = path.join(input.repoPath, relativePath);

            if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
                const content = await fs.promises.readFile(fullPath, "utf-8");
                fileContents.push({
                    path: relativePath,
                    content,
                });
            } else {
                console.warn(`[getFileContent] Warning: File does not exist at ${fullPath}`);
            }
        }

        console.log(`[getFileContent] Read ${fileContents.length} text files successfully.`);

        return {
            issue: input.issue || input.issues,
            relevantFiles: input.relevantFiles,
            fileContents,
        };
    } catch (error) {
        console.error("Error in getFileContent:", error);
        throw new Error("Error fetching file content");
    }
};