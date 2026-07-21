import { prisma } from "../config/prisma.js";
import type { Request, Response, NextFunction } from "express";

export async function isLoggedIn(req: Request, res: Response, next: NextFunction) {
    try {
        // Note: If accessToken is a JWT, you should verify/decode it here first
        const userId = req.cookies?.accessToken || req.headers.authorization?.split(" ")[1];

        if (!userId) {
            res.status(401).json({ error: "Please log in to access this" });
            return;
        }

        const user = await prisma.user.findFirst({
            where: {
                id: userId
            }
        });

        if (!user) {
            res.status(401).json({ error: "The user does not exist" });
            return;
        }

        // Attach user to the request so downstream routes/middlewares can use it
        // @ts-ignore
        req.user = user;

        next();
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
}