import express, { Request, Response } from "express";
import { Prisma, PrismaClient } from "@prisma/client";
import z from "zod";
import jwt from "jsonwebtoken";
const router = express.Router();
const prisma = new PrismaClient();

const userSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  image: z.string().url().optional(),
  id: z.string().optional(),
});
const JWT_SECRET = "hello";
router.route("/").post(async (req: Request, res: Response) => {
  console.log(req);

  const result = userSchema.safeParse(req.body);

  if (!result.success) {
    res
      .status(400)
      .json({ error: "Invalid request data", details: result.error.errors });
    return;
  }

  const { email, name, image } = result.data;
  try {
    const user = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        image: image || "",
        name: name || "",
      },
      update: {
        image: image || "",
        name: name || "",
      },
    });

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: "7d",
    });
    console.log(token);
    res.status(200).json({
      message: user ? "Signed in" : "Signed up",
      user,
      token,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to create/update user" });
  }
});
router.route("/lastSeen").post(async (req: Request, res: Response) => {

  const result = z
    .object({
      id: z.string(),
      lastSeen: z.string().refine((date) => !isNaN(Date.parse(date)), {
        message: "Invalid date format",
      }),
    })
    .safeParse(req.body);
  if (!result.success) {
    res
      .status(400)
      .json({ error: "Invalid request data", details: result.error.errors });
    return;
  }
  const { id, lastSeen }: { id: string; lastSeen: any } = result.data;
  try {
    if (!lastSeen) {
      res.status(400).json({ error: "lastSeen is required" });
      return;
    }
    
    const user = await prisma.user.update({
      where: { id },
      data: { lastSeen: new Date(lastSeen) },
    });

    res.status(200).json({ user });
  } catch (error) {
    res.status(500).json({ error: "Failed to update user" });
  }
});
router.route("/:email").get(async (req: Request, res: Response) => {
  const { email } = req.params;
  if (!email) {
    res.status(400).json({ error: "Missing email in request params" });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });
    if (!user) {
      res.status(201).json({ error: "User not found" });
      return;
    }
    res.status(200).json({ user });
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve user" });
  }
});

export const userRouter = router;
