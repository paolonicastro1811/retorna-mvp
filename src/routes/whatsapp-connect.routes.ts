/**
 * WhatsApp Connection Routes — Per-restaurant WhatsApp Business via Embedded Signup
 *
 * POST /whatsapp/connect     — Save WhatsApp connection after Embedded Signup
 * GET  /whatsapp/status      — Check WhatsApp connection status
 * POST /whatsapp/disconnect  — Disconnect WhatsApp from restaurant
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../database/client';

const router = Router();

// POST /whatsapp/connect — Save WhatsApp connection from Embedded Signup
router.post('/connect', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Nao autorizado' });

    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Codigo de autorizacao necessario' });

    const FB_APP_ID = process.env.FB_APP_ID;
    const FB_APP_SECRET = process.env.FB_APP_SECRET;

    if (!FB_APP_ID || !FB_APP_SECRET) {
      return res.status(500).json({ error: 'Facebook App nao configurado no servidor' });
    }

    // 1. Exchange code for token
    const tokenRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${FB_APP_ID}&client_secret=${FB_APP_SECRET}&code=${code}`
    );
    const tokenData = await tokenRes.json() as any;

    if (tokenData.error) {
      console.error('[WhatsApp Connect] Token exchange error:', tokenData.error);
      return res.status(400).json({ error: 'Falha na autorizacao do Facebook' });
    }

    const accessToken = tokenData.access_token;

    // 2. Get shared WABA ID from the debug token
    const debugRes = await fetch(
      `https://graph.facebook.com/v21.0/debug_token?input_token=${accessToken}`,
      { headers: { Authorization: `Bearer ${FB_APP_ID}|${FB_APP_SECRET}` } }
    );
    const debugData = await debugRes.json() as any;
    console.log('[WhatsApp Connect] Debug token data:', JSON.stringify(debugData, null, 2));

    // 3. Frontend sends waba_id and phone_number_id from the Embedded Signup callback
    const { waba_id, phone_number_id } = req.body;

    if (!waba_id || !phone_number_id) {
      return res.status(400).json({ error: 'WABA ID e Phone Number ID necessarios' });
    }

    // 4. Subscribe app to WABA webhooks
    await fetch(
      `https://graph.facebook.com/v21.0/${waba_id}/subscribed_apps`,
      { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } }
    );

    // 5. Get phone number display info
    const phoneRes = await fetch(
      `https://graph.facebook.com/v21.0/${phone_number_id}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const phoneData = await phoneRes.json() as any;
    const displayPhone = phoneData.display_phone_number || phoneData.verified_name || '';

    // 6. Register phone number (if needed)
    await fetch(
      `https://graph.facebook.com/v21.0/${phone_number_id}/register`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messaging_product: 'whatsapp', pin: '000000' }),
      }
    );

    // 7. Save to restaurant
    const restaurant = await prisma.restaurant.update({
      where: { id: user.restaurantId },
      data: {
        wabaId: waba_id,
        waPhoneNumberId: phone_number_id,
        waAccessToken: accessToken,
        waPhoneNumber: displayPhone,
        waConnectedAt: new Date(),
      },
    });

    console.log(`[WhatsApp] Connected for restaurant ${restaurant.id}: ${displayPhone}`);

    res.json({
      connected: true,
      phoneNumber: displayPhone,
      connectedAt: restaurant.waConnectedAt,
    });
  } catch (err) {
    console.error('[WhatsApp Connect] Error:', err);
    res.status(500).json({ error: 'Erro ao conectar WhatsApp' });
  }
});

// GET /whatsapp/status — Check WhatsApp connection status
router.get('/status', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Nao autorizado' });

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: user.restaurantId },
      select: { waPhoneNumber: true, waConnectedAt: true, wabaId: true, waPhoneNumberId: true },
    });

    if (!restaurant || !restaurant.wabaId) {
      return res.json({ connected: false });
    }

    res.json({
      connected: true,
      phoneNumber: restaurant.waPhoneNumber,
      connectedAt: restaurant.waConnectedAt,
    });
  } catch (err) {
    console.error('[WhatsApp Status] Error:', err);
    res.status(500).json({ error: 'Erro ao verificar status' });
  }
});

// POST /whatsapp/disconnect — Disconnect WhatsApp
router.post('/disconnect', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Nao autorizado' });

    await prisma.restaurant.update({
      where: { id: user.restaurantId },
      data: {
        wabaId: null,
        waPhoneNumberId: null,
        waAccessToken: null,
        waPhoneNumber: null,
        waConnectedAt: null,
      },
    });

    console.log(`[WhatsApp] Disconnected for restaurant ${user.restaurantId}`);
    res.json({ connected: false });
  } catch (err) {
    console.error('[WhatsApp Disconnect] Error:', err);
    res.status(500).json({ error: 'Erro ao desconectar' });
  }
});

export default router;
