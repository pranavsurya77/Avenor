import type { Request, Response } from "express";
import axios from "axios";
import { prisma } from "../config/prisma.js";
import { createAccessToken, createRefreshToken } from "../utils/token.js";
import { cookieOptions } from "../utils/cookieOptions.js";

const CLIENT_ID = process.env.CLIENT_ID!;
const CLIENT_SECRET = process.env.CLIENT_SECRET!;

export async function githubLogin(req: Request, res: Response) {
    const redirectUri = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&scope=user:email`;
    res.redirect(redirectUri);
}

export async function githubCallback(req: Request, res: Response) {
    const code = req.query.code as string;

    if (!code) {
        res.status(400).json({ error: "No code provided" });
        return;
    }

    try {
        // Exchange code for access token
        const tokenResponse = await axios.post(
            "https://github.com/login/oauth/access_token",
            {
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                code: code,
            },
            {
                headers: {
                    Accept: "application/json",
                },
            }
        );

        const accessToken = tokenResponse.data.access_token;
        if (!accessToken) {
            res.status(400).json({ error: "Failed to get access token", details: tokenResponse.data });
            return;
        }

        // Get user profile
        const userResponse = await axios.get("https://api.github.com/user", {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        const githubUser = userResponse.data;

        // Get user email
        const emailResponse = await axios.get("https://api.github.com/user/emails", {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        const primaryEmailObj = emailResponse.data.find((e: any) => e.primary);
        const email = primaryEmailObj ? primaryEmailObj.email : null;

        if (!email) {
            res.status(400).json({ error: "GitHub account must have an email" });
            return;
        }

        // Find or create user in DB
        let user = await prisma.user.findFirst({
            where: {
                OR: [
                    { githubId: String(githubUser.id) },
                    { email: email }
                ]
            }
        });

        if (user) {
            // Update githubId/githubLogin if they previously signed up with email
            if (!user.githubId || !user.githubLogin) {
                user = await prisma.user.update({
                    where: { id: user.id },
                    data: {
                        githubId: String(githubUser.id),
                        githubLogin: githubUser.login,
                    }
                });
            }
        } else {
            // Create new user
            user = await prisma.user.create({
                data: {
                    email: email,
                    githubId: String(githubUser.id),
                    githubLogin: githubUser.login,
                    name: githubUser.name || githubUser.login,
                    avatarUrl: githubUser.avatar_url,
                    role: "USER"
                }
            });
        }

        // Generate tokens
        const apiAccessToken = await createAccessToken(user);
        const refreshToken = await createRefreshToken(user);

        res.cookie("accessToken", apiAccessToken, cookieOptions);
        res.cookie("refreshToken", refreshToken, cookieOptions);

        res.status(200).json({ message: "Successfully logged in with GitHub", user });
    } catch (error: any) {
        console.error(error.response?.data || error);
        res.status(500).json({ error: "Internal server error" });
    }
}
