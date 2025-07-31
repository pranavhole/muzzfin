import express, { Request, Response } from "express";
import { Prisma, PrismaClient } from "@prisma/client";
import z from 'zod';
import jwt from 'jsonwebtoken'
const router = express.Router();
const prisma = new PrismaClient();

const userSchema = z.object({
    email: z.string().email(),
    name: z.string().optional(),
    image: z.string().url().optional(),
    id: z.string().optional(),
});
const JWT_SECRET = 'hello'
router.route("/").post(async (req: Request, res: Response) => {
    console.log(req);
    
    const result = userSchema.safeParse(req.body);

    if (!result.success) {
        res.status(400).json({ error: "Invalid request data", details: result.error.errors });
        return;
    }

    const { email, name, image } = result.data;
    try {
        const user = await prisma.user.upsert({
            where: { email },
            create: {
                email,
                image: image || '',
                name: name || ''
            },
            update: {
                image: image || '',
                name: name || ''
            }
        });

        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
            expiresIn: "7d",
        });
        console.log(token)
        res.status(200).json({
            message: user ? "Signed in" : "Signed up",
            user,
            token,
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to create/update user" });
    }
});
router.route("/").get(async (req: Request, res: Response) => {
    const { email, password } = req.body;

});

export const userRouter = router;
