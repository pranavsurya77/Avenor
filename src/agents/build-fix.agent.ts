import { runInteractiveAgentLoop } from "../tools/agentRunner.js";
import type { ValidationResult } from "../validation/validateRepository.js";
import type { PipelineContext } from "../context/pipeline.context.js";

interface BuildInput {
    context: PipelineContext,
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
        fixes?: any[];
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
            7. 'create_file': Create a new file in the repository with the specified content.
            8. 'submit_fix': Submit your final code changes using search/replace blocks.

            Instructions:
            - Use 'read_multiple_files' when inspecting multiple files to conserve turns and tokens.
            - Explore import chains and relevant files to verify your solution.
            - If you need to create a new file, call 'create_file' with 'filePath' and 'content'.
            - To submit code changes, call 'submit_fix' with a list of 'fixes'. Each fix must contain the relative file path and one or more replacement chunks.
            - For search/replace blocks, specify the exact character sequence to be replaced (including leading whitespace and newlines) as the 'search' block. Ensure it exists uniquely in the target file.
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
            await input.context.log("INFO", "[build-fix] Launching interactive tool loop...");
            console.log("[build-fix] Launching interactive tool loop...");
            const loopResult = await runInteractiveAgentLoop(
                input.context,
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
                    fixes: loopResult.fixes || [],
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
        await input.context.log("ERROR", "[Build fix Agent]Error fixing build issue");
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