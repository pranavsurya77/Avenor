import jwt from "jsonwebtoken";

function createAccessToken(payload: object) {
    return jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET!, { expiresIn: "15m" });
}

function createRefreshToken(payload: object) {
    return jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET!, { expiresIn: "7d" });
}

function verifyAccessToken(token: string) {
    return jwt.verify(token, process.env.ACCESS_TOKEN_SECRET!);
}

function verifyRefreshToken(token: string) {
    return jwt.verify(token, process.env.REFRESH_TOKEN_SECRET!);
}

export { createAccessToken, createRefreshToken, verifyAccessToken, verifyRefreshToken };
