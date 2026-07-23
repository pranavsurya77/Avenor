

export type User = {
    id: string;
    email: string;
    password?: string;
    githubId?: string;
    githubLogin?: string;
    role: "USER" | "ADMIN";
    name?: string;
    avatarUrl?: string;
    createdAt: Date;
    updatedAt: Date;
}