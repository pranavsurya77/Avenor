import { exec } from "child_process";
import fs from "fs/promises";
import path from "path";
import { promisify } from "util";
import type { ProjectType } from "./detectProject.js";

const execAsync = promisify(exec);

export interface RunBuildResult {
    commandUsed: string;
    buildPassed: boolean;
    buildOutput: string;
    buildDurationMs: number;
}

/**
 * Determines the appropriate build command for a given project ecosystem.
 */
async function getBuildCommand(repoPath: string, projectType: ProjectType): Promise<string | null> {
    const fileExists = async (fileName: string): Promise<boolean> => {
        try {
            await fs.access(path.join(repoPath, fileName));
            return true;
        } catch {
            return false;
        }
    };

    const isWindows = process.platform === "win32";

    switch (projectType) {
        case "node": {
            try {
                const pkgPath = path.join(repoPath, "package.json");
                const pkgContent = await fs.readFile(pkgPath, "utf-8");
                const pkgJson = JSON.parse(pkgContent);

                if (pkgJson.scripts && pkgJson.scripts.build) {
                    return "npm run build";
                }
            } catch { }

            if (await fileExists("tsconfig.json")) {
                return "npx tsc --noEmit";
            }
            return "npm run build";
        }
        case "maven": {
            if (await fileExists(isWindows ? "mvnw.cmd" : "mvnw")) {
                return isWindows ? ".\\mvnw.cmd clean compile" : "./mvnw clean compile";
            }
            return "mvn clean compile";
        }
        case "gradle": {
            if (await fileExists(isWindows ? "gradlew.bat" : "gradlew")) {
                return isWindows ? ".\\gradlew.bat build" : "./gradlew build";
            }
            return "gradle build";
        }
        case "rust":
            return "cargo build";
        case "go":
            return "go build ./...";
        case "python":
            return "python -m py_compile";
        default:
            return null;
    }
}

/**
 * Executes the project build command inside the repository directory and measures duration & status.
 * 
 * @param repoPath - Absolute path to local repository directory.
 * @param projectType - The detected ProjectType.
 * @param timeoutMs - Maximum execution timeout in milliseconds (default: 60000ms).
 */
export async function runBuild(
    repoPath: string,
    projectType: ProjectType,
    timeoutMs = 60000
): Promise<RunBuildResult> {
    const startTime = Date.now();
    const command = await getBuildCommand(repoPath, projectType);

    if (!command) {
        return {
            commandUsed: "N/A",
            buildPassed: true,
            buildOutput: `Skipped build: No build step configured for project type '${projectType}'.`,
            buildDurationMs: 0
        };
    }

    console.log(`[runBuild] Running build command: '${command}' in ${repoPath}`);

    try {
        const { stdout, stderr } = await execAsync(command, {
            cwd: repoPath,
            timeout: timeoutMs,
            maxBuffer: 10 * 1024 * 1024
        });

        const duration = Date.now() - startTime;
        const output = (stdout + "\n" + stderr).trim();

        return {
            commandUsed: command,
            buildPassed: true,
            buildOutput: output || "Build completed successfully with no output.",
            buildDurationMs: duration
        };
    } catch (error: any) {
        const duration = Date.now() - startTime;
        const stdout = error.stdout || "";
        const stderr = error.stderr || "";
        const combinedOutput = (stdout + "\n" + stderr + "\n" + (error.message || "")).trim();

        console.error(`[runBuild] Build failed for command '${command}' (${duration}ms):`, error.message);

        return {
            commandUsed: command,
            buildPassed: false,
            buildOutput: combinedOutput,
            buildDurationMs: duration
        };
    }
}
