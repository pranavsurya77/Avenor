export interface PipelineContext {
    prismaJobId: string;
    bullJobId: string;

    log: (
        level: "INFO" | "WARN" | "ERROR",
        message: string,
        metadata?: unknown,
    ) => Promise<void>;
}