import { NextRequest, NextResponse } from 'next/server';

const VLLM_URL = process.env.VLLM_GPU1_URL || 'http://100.88.191.49:8000/v1';
const VLLM_FAST_URL = process.env.VLLM_GPU1_FAST_URL || 'http://100.88.191.49:8001/v1';
const VLLM_API_KEY = process.env.VLLM_API_KEY || 'vllm-local-key';
const OPENCLAW_URL = process.env.OPENCLAW_URL || 'http://100.110.74.114:3849';

const SYSTEM_PROMPT = `Tu es un assistant de cadrage et de planification pour la plateforme Dropship.

**MODE DRAFT-ONLY — TU NE PEUX PAS EXÉCUTER D'ACTIONS.**

Tu aides à :
- Rédiger des plans de création de boutique
- Proposer des stratégies produits et marketing
- Suggérer des configurations (design systems, positionnement, mots-clés)
- Clarifier les besoins avant exécution

**INTERDICTIONS STRICTES :**
- Tu NE PEUX PAS créer de shop, lancer de pub, déployer de site, ni appeler d'API.
- Tu NE DOIS JAMAIS dire "j'ai lancé", "c'est créé", "les services sont up", "la campagne est active".
- Tu NE PEUX PAS donner de statut runtime réel (health, produits, services).
- Si l'utilisateur demande une action exécutable, réponds en mode plan/draft et redirige-le vers la **Pipeline A-Z** pour l'exécution réelle.

**CE QUE TU PEUX FAIRE :**
- Proposer un plan structuré (ex: "Voici les étapes que la pipeline pourrait exécuter...")
- Suggérer des mots-clés, design systems, positionnement
- Rédiger des briefs marketing ou des stratégies de contenu
- Clarifier les besoins et poser des questions

Réponds toujours en français, sois concis et professionnel. Rappelle que tu es en mode draft si l'utilisateur semble attendre une exécution.`;

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

    const isFast = model === 'fast';
    const baseUrl = isFast ? VLLM_FAST_URL : VLLM_URL;
    const modelId = isFast
      ? (process.env.VLLM_FAST_MODEL ?? 'Qwen/Qwen2.5-Coder-7B-Instruct-AWQ')
      : (process.env.VLLM_MODEL ?? 'Qwen/Qwen2.5-Coder-32B-Instruct-AWQ');

    // Keep last 10 messages to cap context size (avoid O(n²) token growth)
    const MAX_HISTORY = 10;
    const trimmedMessages = messages.slice(-MAX_HISTORY);

    const fullMessages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...trimmedMessages,
    ];

    const vllmRes = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${VLLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: fullMessages,
        max_tokens: 1024,
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
