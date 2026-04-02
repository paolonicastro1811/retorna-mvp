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
    // Try multiple redirect_uri strategies: page URL, empty, omitted
    const frontendUri = req.body.redirect_uri || '';

    // Strategy 1: Use the page URL from frontend (SDK may use this internally)
    // Strategy 2: Empty string (Meta Embedded Signup docs)
    // Strategy 3: No redirect_uri at all
    const strategies = [
      { label: 'page_url', uri: frontendUri },
      { label: 'empty', uri: '' },
      { label: 'omitted', uri: null },
    ];

    let tokenData: any = null;
    for (const strategy of strategies) {
      const uriParam = strategy.uri !== null ? `&redirect_uri=${encodeURIComponent(strategy.uri)}` : '';
      const tokenUrl = `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${FB_APP_ID}&client_secret=${FB_APP_SECRET}&code=${code}${uriParam}`;
      console.log(`[WhatsApp Connect] Trying strategy="${strategy.label}" redirect_uri=${strategy.uri === null ? '(omitted)' : `"${strategy.uri}"`}`);

      const tokenRes = await fetch(tokenUrl);
      tokenData = await tokenRes.json() as any;

      if (!tokenData.error) {
        console.log(`[WhatsApp Connect] Strategy "${strategy.label}" succeeded!`);
        break;
      }
      console.log(`[WhatsApp Connect] Strategy "${strategy.label}" failed: ${tokenData.error?.message || JSON.stringify(tokenData.error)}`);
    }
    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json() as any;

    if (tokenData.error) {
      console.error('[WhatsApp Connect] Token exchange error:', JSON.stringify(tokenData.error));
      return res.status(400).json({ error: `Falha na autorizacao: ${tokenData.error.message || JSON.stringify(tokenData.error)}` });
    }

    const accessToken = tokenData.access_token;

    // 2. Get waba_id and phone_number_id
    // Try from frontend first (postMessage), otherwise auto-discover via Graph API
    let waba_id = req.body.waba_id || '';
    let phone_number_id = req.body.phone_number_id || '';

    if (!waba_id || !phone_number_id) {
      console.log('[WhatsApp Connect] No waba_id/phone_number_id from frontend, auto-discovering...');

      // Get shared WABAs from the debug token
      const debugRes = await fetch(
        `https://graph.facebook.com/v21.0/debug_token?input_token=${accessToken}`,
        { headers: { Authorization: `Bearer ${FB_APP_ID}|${FB_APP_SECRET}` } }
      );
      const debugData = await debugRes.json() as any;
      console.log('[WhatsApp Connect] Debug token:', JSON.stringify(debugData, null, 2));

      // Extract shared WABA from granular_scopes
      const scopes = debugData?.data?.granular_scopes || [];
      for (const scope of scopes) {
        if (scope.scope === 'whatsapp_business_management' && scope.target_ids?.length > 0) {
          waba_id = scope.target_ids[0];
          break;
        }
      }

      // If still no WABA, try listing shared WABAs
      if (!waba_id) {
        const bizRes = await fetch(
          `https://graph.facebook.com/v21.0/me/businesses?fields=id,name`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const bizData = await bizRes.json() as any;
        console.log('[WhatsApp Connect] Businesses:', JSON.stringify(bizData, null, 2));

        if (bizData.data?.[0]?.id) {
          const wabaRes = await fetch(
            `https://graph.facebook.com/v21.0/${bizData.data[0].id}/owned_whatsapp_business_accounts?fields=id,name`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          const wabaData = await wabaRes.json() as any;
          console.log('[WhatsApp Connect] WABAs:', JSON.stringify(wabaData, null, 2));
          waba_id = wabaData.data?.[0]?.id || '';
        }
      }

      // Get phone numbers from WABA
      if (waba_id && !phone_number_id) {
        const phonesRes = await fetch(
          `https://graph.facebook.com/v21.0/${waba_id}/phone_numbers?fields=id,display_phone_number,verified_name`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const phonesData = await phonesRes.json() as any;
        console.log('[WhatsApp Connect] Phone numbers:', JSON.stringify(phonesData, null, 2));
        phone_number_id = phonesData.data?.[0]?.id || '';
      }
    }

    if (!waba_id || !phone_number_id) {
      console.error('[WhatsApp Connect] Could not discover WABA/phone:', { waba_id, phone_number_id });
      return res.status(400).json({ error: 'Nao foi possivel encontrar sua conta WhatsApp Business. Complete o cadastro no popup do Facebook.' });
    }

    console.log(`[WhatsApp Connect] Using waba_id=${waba_id} phone_number_id=${phone_number_id}`);

    // 3. Subscribe app to WABA webhooks
    await fetch(
      `https://graph.facebook.com/v21.0/${waba_id}/subscribed_apps`,
      { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } }
    );

    // 4. Get phone number display info
    const phoneRes = await fetch(
      `https://graph.facebook.com/v21.0/${phone_number_id}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const phoneData = await phoneRes.json() as any;
    const displayPhone = phoneData.display_phone_number || phoneData.verified_name || '';

    // 5. Register phone number (if needed)
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
