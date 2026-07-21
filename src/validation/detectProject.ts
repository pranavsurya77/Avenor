import fs from "fs/promises";
import path from "path";

export type ProjectType =
    | "node"
    | "maven"
    | "gradle"
    | "rust"
    | "go"
    | "python"
    | "unknown";

/**
 * Detects the project ecosystem type by inspecting indicator files in the repository root directory.
 * 
 * @param repoPath - Absolute path to the local repository workspace.
 * @returns The detected ProjectType.
 */
export async function detectProject(repoPath: string): Promise<ProjectType> {
    try {
        const fileExists = async (fileName: string): Promise<boolean> => {
            try {
                await fs.access(path.join(repoPath, fileName));
                return true;
            } catch {
                return false;
            }
        };

        if (await fileExists("package.json")) {
            return "node";
        }

        if (await fileExists("pom.xml")) {
            return "maven";
        }

        if ((await fileExists("build.gradle")) || (await fileExists("build.gradle.kts"))) {
            return "gradle";
        }

        if (await fileExists("Cargo.toml")) {
            return "rust";
        }

        if (await fileExists("go.mod")) {
            return "go";
        }

        if ((await fileExists("pyproject.toml")) || (await fileExists("requirements.txt"))) {
            return "python";
        }

        return "unknown";
    } catch (error) {
        console.error(`[detectProject] Error detecting project ecosystem in '${repoPath}':`, error);
        return "unknown";
    }
}
