import { runInteractiveAgentLoop } from "../tools/agentRunner.js";
import type { ValidationResult } from "../validation/validateRepository.js";


interface BuildInput {
    validationResult: ValidationResult;
    relevantFiles: string[];
    repoPath: string;
}

type BuildFixResult =
    | {
        userInputRequired: true;
        question: string;
    }
    | {
        userInputRequired: false;
        patch: string;
        explanation: string;
    };


const maxIterations: number = 2 * (Number(process.env.MAX_ITERATIONS) || 10);

export async function fixBuildIssues(
    input: BuildInput
): Promise<BuildFixResult> {
    try {

        const systemPrompt = `
            You are an expert AI software maintenance engineer.
            Your goal is to solve reported build issues by exploring the codebase and producing clean code fixes.

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
            Build Output (Last 200 lines):
            ${input.validationResult.buildOutput.split("\n").slice(-200).join("\n")}

            Project Type:
            ${input.validationResult.projectType}

            Build Command:
            ${input.validationResult.commandUsed}

            Build Duration:
            ${input.validationResult.buildDurationMs}ms

            Relevent files:
            ${input.relevantFiles.join(", ")}

            Repo Path: ${input.repoPath}

            Use your tools to inspect the codebase and solve this issue. When done fixing the issue, call submit_fix
        `;

        if (input.repoPath) {
            console.log("[build-fix] Launching interactive tool loop...");
            const loopResult = await runInteractiveAgentLoop(
                systemPrompt,
                userPrompt,
                input.repoPath,
                maxIterations
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
                question: loopResult.question || "Interactive Build fix loop reached max iterations without submitting a fix."
            };
        }

        return {
            userInputRequired: true,
            question: "repoPath is required to run the interactive agent tools."
        };


    } catch (error) {
        console.error(
            "[Build fix Agent] Error fixing build issue",
            error
        );

        throw new Error(
            `Error fixing build issues: ${error instanceof Error
                ? error.message
                : "Unknown error"
            }`
        );
    }
}