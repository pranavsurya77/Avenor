import { Router } from "express";
import type { Request, Response } from "express";

const router = Router();


router.get("/health", (req: Request, res: Response) => {
    res.send("The App is up and alive!!");
})

export { router as healthRouter };