import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { openrouterClient, DEFAULT_MODEL } from "../config/openrouter.js";
import type { ORChatMessage } from "../config/openrouter.js";
import { AGENT_TOOLS, executeToolCall } from "./agentTools.js";
import type { PipelineContext } from "../context/pipeline.context.js";

export interface AgentLoopResult {
    type: "submit_fix" | "ask_user" | "max_iterations";
    patch?: string;
    explanation?: string;
    question?: string;
    rawContent?: string;
    fixes?: any[];
}

export async function runInteractiveAgentLoop(
    context: PipelineContext,
    systemPrompt: string,
    userPrompt: string,
    repoPath: string,
    maxIterations = 10,
): Promise<AgentLoopResult> {
    const messages: ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
    ];

    await context.log("INFO", `[AgentRunner] Starting interactive tool loop (Max steps: ${maxIterations})...`);
    console.log(`[AgentRunner] Starting interactive tool loop (Max steps: ${maxIterations})...`);

    for (let step = 1; step <= maxIterations; step++) {
        await context.log("INFO", `[AgentRunner] --- Iteration Step ${step}/${maxIterations} ---`);
        console.log(`[AgentRunner] --- Iteration Step ${step}/${maxIterations} ---`);

        // Token Optimization: Prune long outputs from older tool calls (keep last 6 messages full)
        if (messages.length > 8) {
            const preserveThreshold = messages.length - 6;
            for (let i = 2; i < preserveThreshold; i++) {
                const msg = messages[i];
                if (msg && msg.role === "tool" && typeof msg.content === "string" && msg.content.length > 250) {
                    messages[i] = {
                        ...msg,
                        content: msg.content.substring(0, 200) + "\n... [Older tool output truncated to conserve context tokens]"
                    };
                }
            }
        }

        const response = await openrouterClient.chat.completions.create({
            model: DEFAULT_MODEL,
            messages: messages as any,
            tools: AGENT_TOOLS,
            temperature: 0.1
        });

        const choice = response.choices[0];
        const assistantMessage = choice?.message;

        if (!assistantMessage) {
            await context.log("ERROR", "[AgentRunner] No message returned from model.");
            console.error("[AgentRunner] No message returned from model.");
            break;
        }

        messages.push(assistantMessage);

        const toolCalls = assistantMessage.tool_calls;
        if (!toolCalls || toolCalls.length === 0) {
            await context.log("INFO", "[AgentRunner] Model finished turn without further tool calls.")
            console.log("[AgentRunner] Model finished turn without further tool calls.");
            const content = assistantMessage.content || "";
            return {
                type: "submit_fix",
                explanation: content,
                rawContent: content
            };
        }

        for (const tc of toolCalls) {
            if (tc.type !== "function") continue;

            const toolName = tc.function.name;
            let toolArgs: any = {};
            try {
                toolArgs = JSON.parse(tc.function.arguments || "{}");
            } catch (err) {
                await context.log("ERROR", `[AgentRunner] Failed to parse tool args for '${toolName}':`, err);
                console.error(`[AgentRunner] Failed to parse tool args for '${toolName}':`, err);
            }

            await context.log("INFO", `[AgentRunner] Tool Invoked: '${toolName}'`, toolArgs);
            console.log(`[AgentRunner] Tool Invoked: '${toolName}'`, toolArgs);

            if (toolName === "submit_fix") {
                await context.log("INFO", "[AgentRunner] 'submit_fix' tool called. Returning final changes.");
                console.log("[AgentRunner] 'submit_fix' tool called. Returning final changes.");
                return {
                    type: "submit_fix",
                    patch: toolArgs.patch || "",
                    fixes: toolArgs.fixes || [],
                    explanation: toolArgs.explanation || ""
                };
            }

            if (toolName === "ask_user") {
                await context.log("INFO", "[AgentRunner] 'ask_user' tool called. Clarification requested.");
                console.log("[AgentRunner] 'ask_user' tool called. Clarification requested.");
                return {
                    type: "ask_user",
                    question: toolArgs.question || "Additional input required from user."
                };
            }

            // Execute code reading / searching / list directory tools locally
            const output = await executeToolCall(toolName, toolArgs, repoPath);
            await context.log("INFO", `[AgentRunner] Tool '${toolName}' output length: ${output.length} characters.`, {
                toolName,
                outputLength: output.length
            });
            console.log(`[AgentRunner] Tool '${toolName}' output length: ${output.length} characters.`);

            messages.push({
                role: "tool",
                tool_call_id: tc.id,
                content: output
            });
        }
    }

    await context.log("WARN", "[AgentRunner] Reached maximum iterations without explicit submit_fix or ask_user.");
    console.warn("[AgentRunner] Reached maximum iterations without explicit submit_fix or ask_user.");
    return {
        type: "max_iterations",
        question: "Agent reached maximum iteration limit without submitting a fix."
    };
}
