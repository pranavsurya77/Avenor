import "dotenv/config";
import { App } from "@octokit/app";
import fs from "fs";
import path from "path";

const privateKeyPath = process.env.PRIVATE_KEY_PATH;

if (!privateKeyPath) {
    throw new Error("PRIVATE_KEY_PATH environment variable is missing.");
}

const privateKey = fs.readFileSync(path.resolve(process.cwd(), privateKeyPath), "utf8");

export const githubApp = new App({
    appId: process.env.APP_ID!,
    privateKey: privateKey,
    oauth: {
        clientId: process.env.CLIENT_ID!,
        clientSecret: process.env.CLIENT_SECRET!,
    },
});