import type { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma.js";

//only allows admin to pass through
export async function isAdmin(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = req.cookies?.accessToken || req.headers.authorization?.split(" ")[1];

        if (!userId) {
            res.status(401).json({ error: "Unauthorized: Please log in" });
            return;
        }

        const user = await prisma.user.findFirst({
            where: {
                id: userId
            }
        });

        if (!user?.role) {
            res.status(401).json({ error: "The user does not exist." });
            return;
        }

        if (user.role === "ADMIN") {
            next();
        } else {
            res.status(403).json({ error: "Forbidden: Admin access required" });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
}