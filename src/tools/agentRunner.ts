import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { nvidiaClient, DEFAULT_MODEL } from "../config/nvidia.js";
import { AGENT_TOOLS, executeToolCall } from "./agentTools.js";

export interface AgentLoopResult {
    type: "submit_fix" | "ask_user" | "max_iterations";
    patch?: string;
    explanation?: string;
    question?: string;
    rawContent?: string;
}

export async function runInteractiveAgentLoop(
    systemPrompt: string,
    userPrompt: string,
    repoPath: string,
    maxIterations = 10
): Promise<AgentLoopResult> {
    const messages: ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
    ];

    console.log(`[AgentRunner] Starting interactive tool loop (Max steps: ${maxIterations})...`);

    for (let step = 1; step <= maxIterations; step++) {
        console.log(`[AgentRunner] --- Iteration Step ${step}/${maxIterations} ---`);

        const response = await nvidiaClient.chat.completions.create({
            model: DEFAULT_MODEL,
            messages,
            tools: AGENT_TOOLS,
            temperature: 0.1
        });

        const choice = response.choices[0];
        const assistantMessage = choice?.message;

        if (!assistantMessage) {
            console.error("[AgentRunner] No message returned from model.");
            break;
        }

        messages.push(assistantMessage);

        const toolCalls = assistantMessage.tool_calls;
        if (!toolCalls || toolCalls.length === 0) {
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
                console.error(`[AgentRunner] Failed to parse tool args for '${toolName}':`, err);
            }

            console.log(`[AgentRunner] Tool Invoked: '${toolName}'`, toolArgs);

            if (toolName === "submit_fix") {
                console.log("[AgentRunner] 'submit_fix' tool called. Returning final patch.");
                return {
                    type: "submit_fix",
                    patch: toolArgs.patch || "",
                    explanation: toolArgs.explanation || ""
                };
            }

            if (toolName === "ask_user") {
                console.log("[AgentRunner] 'ask_user' tool called. Clarification requested.");
                return {
                    type: "ask_user",
                    question: toolArgs.question || "Additional input required from user."
                };
            }

            // Execute code reading / searching / list directory tools locally
            const output = await executeToolCall(toolName, toolArgs, repoPath);
            console.log(`[AgentRunner] Tool '${toolName}' output length: ${output.length} characters.`);

            messages.push({
                role: "tool",
                tool_call_id: tc.id,
                content: output
            });
        }
    }

    console.warn("[AgentRunner] Reached maximum iterations without explicit submit_fix or ask_user.");
    return {
        type: "max_iterations",
        question: "Agent reached maximum iteration limit without submitting a fix."
    };
}
