import { createCockpitChatHandler } from "@hearst/cockpit-shell/handler";
import { kimi, KIMI_MODEL } from "@/lib/llm/kimi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const { POST } = createCockpitChatHandler({
  llmClient: kimi,
  model: KIMI_MODEL,
  systemPrompt:
    "Tu es l'assistant Kimi intégré à Hearst Merchant — autopilot e-commerce DTC : boutique live en 30s, copilotes IA par store. Réponds en français.",
});
