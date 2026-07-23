import { prisma } from "../config/prisma.js";

export async function logJobEvent(
    prismaJobId: string,
    level: string,
    message: string,
    metadata?: unknown
) {
    let finalMessage = message;
    if (metadata !== undefined && metadata !== null) {
        try {
            if (metadata instanceof Error) {
                finalMessage += `\nError Details: ${metadata.message}\nStack: ${metadata.stack || ""}`;
            } else if (typeof metadata === "object") {
                finalMessage += `\nMetadata: ${JSON.stringify(metadata, null, 2)}`;
            } else {
                finalMessage += `\nMetadata: ${metadata}`;
            }
        } catch (e) {
            finalMessage += `\nMetadata: [Unserializable Object]`;
        }
    }

    await prisma.log.create({
        data: {
            jobId: prismaJobId,
            level,
            message: finalMessage
        }
    });
}