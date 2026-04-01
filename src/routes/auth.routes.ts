/**
 * Auth Routes — Magic Link authentication
 *
 * POST /auth/magic-link  — solicitar link de acesso via email
 * GET  /auth/verify       — validar token e retornar JWT
 */

import { Router, Request, Response } from "express";
import crypto from "crypto";
import { prisma } from "../database/client";
import { signJwt } from "../middleware/jwtAuth";
import { sendMagicLinkEmail } from "../services/email.service";
import { validate } from "../middleware/validate";
import { magicLinkSchema } from "../schemas";

const router = Router();

const MAGIC_LINK_EXPIRES_MINUTES = parseInt(
  process.env.MAGIC_LINK_EXPIRES_MINUTES || "15",
  10
);

/**
 * POST /auth/magic-link
 * Body: { email: string }
 * Envia um magic link para o email se o usuario existir.
 */
router.post("/magic-link", validate(magicLinkSchema), async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "Email e obrigatorio" });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Find user
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: { restaurant: { select: { name: true } } },
  });

  if (!user) {
    return res.status(404).json({ error: "Email nao cadastrado" });
  }

  // Cleanup: delete all expired or used tokens for this email
  await prisma.magicLinkToken.deleteMany({
    where: {
      email: normalizedEmail,
      OR: [
        { usedAt: { not: null } },
        { expiresAt: { lt: new Date() } },
      ],
    },
  });

  // Generate secure token
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + MAGIC_LINK_EXPIRES_MINUTES * 60 * 1000);

  // Save token
  await prisma.magicLinkToken.create({
    data: {
      token,
      email: normalizedEmail,
      expiresAt,
    },
  });

  // Send email
  const APP_URL = process.env.APP_URL || "http://localhost:5173";
  const magicLink = `${APP_URL}/auth/verificar?token=${token}`;

  try {
    await sendMagicLinkEmail(normalizedEmail, token, user.restaurant.name);
  } catch (err) {
    console.error("[Auth] Failed to send magic link email:", err);
    return res.status(500).json({ error: "Erro ao enviar email" });
  }

  // In dev mode, also return the magic link in the response for easy testing
  const isDev = process.env.NODE_ENV !== "production";
  res.json({
    message: "Link de acesso enviado para seu email",
    ...(isDev && { magicLink }),
  });
});

/**
 * GET /auth/verify?token=xxx
 * Valida o token, marca como usado, retorna JWT + dados do usuario.
 */
router.get("/verify", async (req: Request, res: Response) => {
  const { token } = req.query;

  if (!token || typeof token !== "string") {
    return res.status(400).json({ error: "Token e obrigatorio" });
  }

  // Find valid token
  const magicToken = await prisma.magicLinkToken.findUnique({
    where: { token },
  });

  if (!magicToken) {
    return res.status(401).json({ error: "Link invalido" });
  }

  if (magicToken.usedAt) {
    return res.status(401).json({ error: "Este link ja foi utilizado" });
  }

  if (magicToken.expiresAt < new Date()) {
    return res.status(401).json({ error: "Link expirado. Solicite um novo." });
  }

  // Mark as used
  await prisma.magicLinkToken.update({
    where: { id: magicToken.id },
    data: { usedAt: new Date() },
  });

  // Find user
  const user = await prisma.user.findUnique({
    where: { email: magicToken.email },
    include: { restaurant: { select: { name: true } } },
  });

  if (!user) {
    return res.status(401).json({ error: "Usuario nao encontrado" });
  }

  // Generate JWT (30 days)
  const jwt = signJwt({
    userId: user.id,
    email: user.email,
    restaurantId: user.restaurantId,
  });

  res.json({
    token: jwt,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      restaurantId: user.restaurantId,
      restaurantName: user.restaurant.name,
    },
  });
});

export const authRouter = router;
