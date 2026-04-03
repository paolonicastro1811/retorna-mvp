/**
 * Auth Routes — Magic Link authentication
 *
 * POST /auth/magic-link  — solicitar link de acesso via email
 * GET  /auth/verify       — validar token e retornar JWT
 */

import { Router, Request, Response } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
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
  const savedToken = await prisma.magicLinkToken.create({
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
  } catch (err: any) {
    // Cleanup orphan token on email failure
    await prisma.magicLinkToken.delete({ where: { id: savedToken.id } }).catch(() => {});
    console.error("[Auth] Failed to send magic link email:", err);
    return res.status(500).json({ error: "Erro ao enviar email", detail: err.message || String(err) });
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

  // Atomic: find + mark as used in one step (prevents TOCTOU race)
  const result = await prisma.magicLinkToken.updateMany({
    where: { token, usedAt: null, expiresAt: { gte: new Date() } },
    data: { usedAt: new Date() },
  });

  if (result.count === 0) {
    return res.status(401).json({ error: "Link invalido, expirado ou ja utilizado" });
  }

  const magicToken = await prisma.magicLinkToken.findUnique({ where: { token } });
  if (!magicToken) return res.status(401).json({ error: "Link invalido" });

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

/**
 * POST /auth/reset-password
 * Body: { email: string }
 * Envia um magic link para redefinir a senha.
 */
router.post("/reset-password", async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email é obrigatório" });

  const normalizedEmail = email.toLowerCase().trim();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: { restaurant: { select: { name: true } } },
  });

  // Always return success (don't reveal if email exists)
  if (!user) {
    return res.json({ message: "Se o email existir, você receberá um link para redefinir sua senha." });
  }

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min

  await prisma.magicLinkToken.create({
    data: { token, email: normalizedEmail, expiresAt },
  });

  const APP_URL = process.env.APP_URL || "http://localhost:5173";
  const resetLink = `${APP_URL}/auth/redefinir-senha?token=${token}`;

  try {
    await sendMagicLinkEmail(normalizedEmail, token, user.restaurant.name);
  } catch (err: any) {
    console.error("[Auth] Failed to send reset email:", err);
  }

  res.json({ message: "Se o email existir, você receberá um link para redefinir sua senha." });
});

/**
 * POST /auth/set-password
 * Body: { token: string, password: string }
 * Redefine a senha usando o magic link token.
 */
router.post("/set-password", async (req: Request, res: Response) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ error: "Token e senha são obrigatórios" });
  }

  if (password.length < 10) {
    return res.status(400).json({ error: "Senha deve ter no mínimo 10 caracteres" });
  }
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
    return res.status(400).json({ error: "Senha deve conter maiúscula, minúscula e número" });
  }

  // Atomic: find + mark as used in one step (prevents TOCTOU race)
  const atomicResult = await prisma.magicLinkToken.updateMany({
    where: { token, usedAt: null, expiresAt: { gte: new Date() } },
    data: { usedAt: new Date() },
  });

  if (atomicResult.count === 0) {
    return res.status(401).json({ error: "Link inválido ou expirado" });
  }

  const magicToken = await prisma.magicLinkToken.findUnique({ where: { token } });
  if (!magicToken) return res.status(401).json({ error: "Link inválido" });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.update({
    where: { email: magicToken.email },
    data: { passwordHash },
    include: { restaurant: { select: { name: true } } },
  });

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

/**
 * POST /auth/login
 * Body: { email: string, password: string }
 * Login classico con email e password.
 */
router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email e senha são obrigatórios" });
  }

  const normalizedEmail = email.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: { restaurant: { select: { name: true } } },
  });

  if (!user) {
    return res.status(401).json({ error: "Email ou senha incorretos" });
  }

  if (!user.passwordHash) {
    return res.status(401).json({ error: "Conta sem senha. Use o link mágico ou redefina sua senha." });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Email ou senha incorretos" });
  }

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
