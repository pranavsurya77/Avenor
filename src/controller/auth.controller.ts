import { prisma } from "../config/prisma.js";
import type { User } from "../models/user.model.js";
import type { Request, Response } from "express";
import { z } from "zod";
import { createAccessToken, createRefreshToken } from "../utils/token.js";
import bcrypt from "bcryptjs";
import { cookieOptions } from "../utils/cookieOptions.js";




const signUpSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters").optional(),
    email: z.string().email("Invalid email format"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    avatarUrl: z.url("The avatar url must be a url").optional()
});

const signInSchema = z.object({
    email: z.string().email("Invalid email format"),
    password: z.string().min(6, "Password must be at least 6 characters"),
});

export async function signUp(req: Request, res: Response) {
    try {
        const validationResult = signUpSchema.safeParse(req.body);

        if (!validationResult.success) {
            return res.status(400).json({
                error: "Validation failed",
                details: validationResult.error.issues
            });
        }

        const { name, email, password } = validationResult.data;
        const existingUser = await prisma.user.findFirst({
            where: {
                email: email
            }
        })

        if (existingUser) {
            return res.status(409).json({ error: "User already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                name: name ?? null,
                email,
                password: hashedPassword,
                role: "USER",
            },
        });

        return res.status(201).json({ user });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Internal server error" });
    }
}

export async function signIn(req: Request, res: Response) {
    try {
        const validationResult = signInSchema.safeParse(req.body);

        if (!validationResult.success) {
            return res.status(400).json({
                error: "Validation failed",
                details: validationResult.error.issues
            });
        }

        const { email, password } = validationResult.data;

        const user = await prisma.user.findFirst({
            where: {
                email: email
            }
        })

        if (!user || !user.password) {
            return res.status(401).json({ error: "Invalid credentials!! Try again." });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({
                error: "Invalid credentials!! Try again."
            });
        }

        const accessToken = await createAccessToken(user);
        const refreshToken = await createRefreshToken(user);

        if (!accessToken || !refreshToken) {
            return res.status(500).json({ error: "Error generating tokens" });
        }

        res.cookie("accessToken", accessToken, cookieOptions);

        res.cookie("refreshToken", refreshToken, cookieOptions);

        res.status(200).json({
            message: "User signed in successfully", user
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Internal server error" });
    }
}

export async function logOut(req: Request, res: Response) {
    try {
        res.clearCookie("accessToken");
        res.clearCookie("refreshToken");
        res.status(200).json({
            message: "User logged out successfully"
        })
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Internal server error" });
    }
}