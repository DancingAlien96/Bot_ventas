import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { config } from './config';
import { initDatabase } from './database';
import { aiService } from './services/AIService';
import { ycloudService } from './services/YCloudService';
import { UserRepository } from './database/repositories/UserRepository';

const app = express();
const PORT = config.server.port || 3000;

function getSignatureHeader(req: Request): string | undefined {
  // YCloud docs specify header `YCloud-Signature` with format: t=<timestamp>,s=<signature>
  return (
    req.header('YCloud-Signature') ||
    req.header('ycloud-signature') ||
    req.header('X-YCloud-Signature') ||
    req.header('x-yc-signature') ||
    undefined
  );
}

function safeCompare(a: string, b: string): boolean {
  try {
    if (!a || !b || a.length !== b.length) return false;
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch (err) {
    return false;
  }
}

function verifyYCloudSignature(rawBody: Buffer, signatureHeader?: string): {ok: boolean; reason?: string} {
  if (!config.ycloud.webhookSecret) {
    return { ok: true };
  }

  if (!signatureHeader) return { ok: false, reason: 'missing header' };

  // parse header e.g. "t=1654084800,s=8eb7..."
  const parts = signatureHeader.split(',').map(p => p.trim());
  const map: Record<string,string> = {};
  for (const p of parts) {
    const [k, v] = p.split('=');
    if (k && v) map[k] = v;
  }

  const ts = map['t'];
  const sig = map['s'];
  if (!ts || !sig) return { ok: false, reason: 'invalid header format' };

  const now = Math.floor(Date.now() / 1000);
  const tsNum = parseInt(ts, 10);
  const tolerance = 300; // 5 minutes
  if (Number.isNaN(tsNum) || Math.abs(now - tsNum) > tolerance) {
    return { ok: false, reason: 'timestamp out of tolerance' };
  }

  const signedPayload = `${ts}.${rawBody.toString('utf-8')}`;
  const expected = crypto.createHmac('sha256', config.ycloud.webhookSecret).update(signedPayload).digest('hex');

  if (!safeCompare(expected, sig)) {
    return { ok: false, reason: 'signature mismatch' };
  }

  return { ok: true };
}

app.post('/webhook/ycloud', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  const rawBody: Buffer = req.body as Buffer;
  const signatureHeader = getSignatureHeader(req);

  // Validate signature following YCloud docs
  const verification = verifyYCloudSignature(rawBody, signatureHeader);
  if (!verification.ok) {
    console.warn('Firma inválida en webhook YCloud:', verification.reason);
    return res.status(401).send('invalid signature');
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody.toString('utf-8'));
  } catch (error) {
    console.error('JSON inválido en webhook YCloud');
    return res.status(400).send('invalid json');
  }

  // Acknowledge quickly
  res.status(200).send('ok');

  // Only handle inbound messages
  if (payload.type !== 'whatsapp.inbound_message.received') {
    return;
  }

  const inbound = payload.whatsappInboundMessage;
  const from = inbound?.from;
  const text = inbound?.text?.body;
  const name = inbound?.customerProfile?.name;

  if (!from || !text) {
    console.warn('Webhook YCloud sin from o text, se omite');
    return;
  }

  try {
    // Find or create user by phone
    const user = await UserRepository.findOrCreateByPhone(from, name || 'Cliente');

    // Log inbound for debugging
    console.log('Webhook inbound:', { from, to: inbound?.to, text });

    // An inbound WhatsApp message opens the 24h customer service window.
    await UserRepository.setLastIncomingByPhone(from, new Date());

    // Get AI response
    const reply = await aiService.chat(user.id, text);

    // Log AI reply before sending
    console.log('IA reply:', { userId: user.id, reply: reply.slice(0,200) });

    const businessNumber = inbound?.to;

    const sendResult = await ycloudService.sendTextMessage(from, reply, businessNumber);
    console.log('YCloud send result:', sendResult);
  } catch (error) {
    console.error('Error procesando webhook de YCloud:', error);
  }
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'ycloud-webhook' });
});

(async () => {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`🚀 Webhook YCloud escuchando en puerto ${PORT}`);
  });
})();
