/**
 * JWT Auth Middleware — verifica Bearer token no header Authorization.
 * Decodifica o payload e adiciona req.user com { userId, email, restaurantId }.
 */

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me-in-production";

export interface JwtPayload {
  userId: string;
  email: string;
  restaurantId: string;
}

export function jwtAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token nao fornecido" });
  }

  const token = authHeader.slice(7); // Remove "Bearer "

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    (req as any).user = {
      userId: decoded.userId,
      email: decoded.email,
      restaurantId: decoded.restaurantId,
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token invalido ou expirado" });
  }
}

/**
 * signJwt — Gera um JWT com payload do usuario.
 */
export function signJwt(payload: JwtPayload): string {
  // Convert "30d" to seconds for jwt.sign
  const expiresStr = process.env.JWT_EXPIRES_IN || "30d";
  const match = expiresStr.match(/^(\d+)([dhms])$/);
  let expiresInSec = 30 * 24 * 60 * 60; // default 30 days

  if (match) {
    const num = parseInt(match[1], 10);
    const unit = match[2];
    if (unit === "d") expiresInSec = num * 86400;
    else if (unit === "h") expiresInSec = num * 3600;
    else if (unit === "m") expiresInSec = num * 60;
    else if (unit === "s") expiresInSec = num;
  }

  return jwt.sign(payload, JWT_SECRET, { expiresIn: expiresInSec });
}
