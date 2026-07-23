import { prisma } from "../config/prisma.js";
import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/token.js";
import type { JwtPayload } from "jsonwebtoken";
import axios from "axios";

export async function isLoggedIn(req: Request, res: Response, next: NextFunction) {
    try {
        const token = req.cookies?.accessToken || req.headers.authorization?.split(" ")[1];

        if (!token) {
            res.status(401).json({ error: "Please log in to access this" });
            return;
        }

        let user: any = null;

        // 1. Try verifying as application JWT token first
        try {
            const decoded = verifyAccessToken(token);
            const userId = typeof decoded === "object" && decoded !== null ? decoded.id : undefined;

            if (userId) {
                user = await prisma.user.findFirst({
                    where: { id: userId }
                });
            }
        } catch (jwtErr) {
            // Not a valid app JWT or expired
        }

        // 2. If JWT failed, try verifying as GitHub OAuth Access Token (e.g. gho_...)
        if (!user) {
            try {
                const userResponse = await axios.get("https://api.github.com/user", {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const ghUser = userResponse.data;

                if (ghUser && ghUser.id) {
                    let email = ghUser.email;
                    if (!email) {
                        try {
                            const emailResponse = await axios.get("https://api.github.com/user/emails", {
                                headers: { Authorization: `Bearer ${token}` }
                            });
                            const primary = emailResponse.data.find((e: any) => e.primary);
                            email = primary ? primary.email : `${ghUser.login}@github.local`;
                        } catch {
                            email = `${ghUser.login}@github.local`;
                        }
                    }

                    user = await prisma.user.findFirst({
                        where: {
                            OR: [
                                { githubId: String(ghUser.id) },
                                { email: email }
                            ]
                        }
                    });

                    if (!user) {
                        user = await prisma.user.create({
                            data: {
                                email,
                                githubId: String(ghUser.id),
                                githubLogin: ghUser.login,
                                name: ghUser.name || ghUser.login,
                                avatarUrl: ghUser.avatar_url,
                                role: "USER"
                            }
                        });
                    }
                }
            } catch (ghErr) {
                // GitHub token verification failed
            }
        }

        if (!user) {
            res.status(401).json({ error: "Invalid or expired session. Please log in again." });
            return;
        }

        // Attach user to the request object
        (req as any).user = user;

        next();
    } catch (error) {
        console.error("Error in isLoggedIn middleware:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}