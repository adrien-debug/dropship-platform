import { NextRequest, NextResponse } from 'next/server';

const VLLM_URL = process.env.VLLM_GPU1_URL || 'http://100.88.191.49:8000/v1';
const VLLM_FAST_URL = process.env.VLLM_GPU1_FAST_URL || 'http://100.88.191.49:8001/v1';
const VLLM_API_KEY = process.env.VLLM_API_KEY || 'vllm-local-key';
const OPENCLAW_URL = process.env.OPENCLAW_URL || 'http://100.110.74.114:3849';

const SYSTEM_PROMPT = `Tu es l'agent IA de la plateforme Dropship. Tu aides à:
- Créer et gérer des sites e-commerce (storefronts)
- Rechercher des produits (CJ Dropshipping, Medusa catalog)
- Configurer les design systems
- Lancer des campagnes marketing
- Monitorer les services (GPU, Medusa, Supabase)

Tu as accès aux outils suivants via l'API OpenClaw (${OPENCLAW_URL}):
- GET /products/search?q=...&supplier=all|cj|medusa — Recherche de produits
- POST /shop/execute — Créer un shop complet (name, slug, port, design_system, products[])
- GET /health — Statut des services

Quand l'utilisateur veut créer un shop, propose un plan structuré puis exécute-le.
Réponds toujours en français, sois concis et professionnel.`;

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, model = 'fast' } = body as { messages: ChatMessage[]; model?: string };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages[] required' }, { status: 400 });
    }

    const baseUrl = model === 'fast' ? VLLM_FAST_URL : VLLM_URL;

    const fullMessages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages,
    ];

    const vllmRes = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${VLLM_API_KEY}`,
      },
      body: JSON.stringify({
        messages: fullMessages,
        max_tokens: 2048,
        temperature: 0.7,
        stream: false,
      }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!vllmRes.ok) {
      const err = await vllmRes.text().catch(() => '');
      console.error(`[agents/chat] vLLM ${vllmRes.status}:`, err.slice(0, 300));
      return NextResponse.json(
        { error: `vLLM error: ${vllmRes.status}`, details: err.slice(0, 200) },
        { status: 502 }
      );
    }

    const data = await vllmRes.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error('[agents/chat] Error:', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: 'Internal error', message: err instanceof Error ? err.message : 'unknown' },
      { status: 500 }
    );
  }
}
