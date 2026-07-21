import { detectProject, type ProjectType } from "./detectProject.js";
import { runBuild, type RunBuildResult } from "./runBuild.js";

export type ValidationResult = {
    projectType: ProjectType;
    buildPassed: boolean;
    buildOutput: string;
    buildDurationMs: number;
    commandUsed: string;
};

/**
 * Main Orchestration Entry Point for the Validation Layer.
 * Detects the project ecosystem and verifies that the repository compiles cleanly.
 * 
 * @param repoPath - Absolute path to local repository workspace.
 * @returns Structured ValidationResult payload.
 */
export async function validateRepository(repoPath: string): Promise<ValidationResult> {
    console.log(`[ValidationService] Validating repository workspace at: ${repoPath}`);

    // 1. Detect project ecosystem
    const projectType = await detectProject(repoPath);
    console.log(`[ValidationService] Detected project ecosystem: '${projectType}'`);

    // 2. Execute build command
    const buildResult: RunBuildResult = await runBuild(repoPath, projectType);

    console.log(
        `[ValidationService] Validation finished. Passed: ${buildResult.buildPassed} (${buildResult.buildDurationMs}ms)`
    );

    return {
        projectType,
        buildPassed: buildResult.buildPassed,
        buildOutput: buildResult.buildOutput,
        buildDurationMs: buildResult.buildDurationMs,
        commandUsed: buildResult.commandUsed
    };
}
