# Webhook Tunnel Setup for Meta WhatsApp Testing

Meta requires a public HTTPS URL to verify and send webhooks.
This guide covers how to expose `localhost:3000` for real Meta integration testing.

## End-to-End Testing Path

```
1. Database running (Neon cloud or Docker)
2. npm run dev                          → backend on localhost:3000
3. Tunnel running                       → public HTTPS URL
4. Meta Dashboard: paste URL + verify   → GET verification passes
5. Send real WhatsApp message           → POST webhook fires
```

---

## Option A: ngrok (Recommended)

Most reliable for Meta webhook verification. Free tier works fine.

### Setup (one time)

1. Create account: https://dashboard.ngrok.com/signup
2. Copy your authtoken from: https://dashboard.ngrok.com/get-started/your-authtoken
3. Install ngrok: https://ngrok.com/downloads — download the Windows ZIP, extract `ngrok.exe` to project root or a folder in PATH
4. Configure authtoken:

```bash
./ngrok config add-authtoken YOUR_AUTHTOKEN
```

### Run

```bash
./ngrok http 3000
```

ngrok will display output like:

```
Forwarding  https://abc123.ngrok-free.app -> http://localhost:3000
```

### Meta Dashboard Configuration

| Field | Value |
|-------|-------|
| Callback URL | `https://abc123.ngrok-free.app/webhooks/whatsapp` |
| Verify Token | `brasil_restaurante_verify_2026` |

After clicking "Verify and Save", subscribe to the **messages** field.

### Notes

- Free tier gives a random subdomain that changes on each restart — update Meta Dashboard each time.
- ngrok free tier may show an interstitial page for browser requests, but **Meta server-to-server webhook calls are not affected**.
- The `npx ngrok` package may install a macOS binary on Windows — download the Windows binary directly from https://ngrok.com/downloads instead.

---

## Option B: Cloudflare Tunnel (Alternative)

No account required for quick tunnels. Requires `cloudflared` binary.

### Install

Download from: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/

Or via npm (if the binary is compatible with your OS):

```bash
npx cloudflared tunnel --url http://localhost:3000
```

### Output

```
+-----------------------------------------------------------+
|  Your quick Tunnel has been created! Visit it at:         |
|  https://random-words.trycloudflare.com                   |
+-----------------------------------------------------------+
```

### Meta Dashboard Configuration

| Field | Value |
|-------|-------|
| Callback URL | `https://random-words.trycloudflare.com/webhooks/whatsapp` |
| Verify Token | `brasil_restaurante_verify_2026` |

### Notes

- No account or auth needed for quick tunnels.
- URL changes on each restart.
- Less battle-tested with Meta webhooks than ngrok.

---

## Fallback: localtunnel (NOT recommended for Meta)

localtunnel is a pure-Node tunnel that works without native binaries.

```bash
npx localtunnel --port 3000
```

**WARNING**: localtunnel shows an interstitial HTML warning page on first visit to the tunnel URL. This **can break Meta webhook verification** because Meta's GET request may receive the interstitial page instead of the challenge response.

Use localtunnel only for:
- Quick manual testing via curl
- Verifying the backend processes payloads correctly

**Do NOT use for final Meta webhook verification.**

---

## Verifying the Tunnel Works

Before configuring Meta, always test locally:

```bash
# Test GET verification (replace URL with your tunnel URL)
curl -s "https://YOUR_TUNNEL_URL/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=brasil_restaurante_verify_2026&hub.challenge=test123"
# Expected output: test123

# Test health endpoint
curl -s "https://YOUR_TUNNEL_URL/health"
# Expected output: {"status":"ok","timestamp":"..."}
```

If the curl returns HTML instead of the expected response, the tunnel has an interstitial problem — switch to ngrok or Cloudflare.

---

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| Meta verification returns error | Tunnel interstitial page | Switch to ngrok |
| "endpoint offline" | Server not running or tunnel died | Restart both `npm run dev` and tunnel |
| `Recipient phone number not in allowed list` | Meta test mode restriction | Add your phone number in Meta App Dashboard → WhatsApp → API Setup → Test Numbers |
| ngrok binary wrong platform | `npx ngrok` installed macOS binary | Download Windows binary directly from ngrok.com |
