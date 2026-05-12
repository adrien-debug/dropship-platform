import { fal } from '@fal-ai/client';

/**
 * fal.ai fallback for asset generation. Used when ComfyUI isn't configured
 * (no COMFY_DEPLOY_API_KEY / no deployment IDs) but FAL_KEY is set.
 *
 * Model choices (locked here so the rest of the pipeline doesn't care):
 *   - Images: `fal-ai/flux-pro/v1.1` with `image_url` for Kontext-style
 *     reference preservation. Cheaper than Kontext, similar quality on
 *     product photography.
 *   - Videos: `fal-ai/kling-video/v2/master/image-to-video` — 5 seconds,
 *     vertical 9:16. Slower (60-90s) but cheap and decent for promo loops.
 *
 * Returns raw bytes so the caller can persist via uploadToR2 / writeAsset
 * without caring about the backend choice.
 */

let configured = false;

function ensureConfigured() {
  if (configured) return;
  const key = (process.env.FAL_KEY || '').trim();
  if (!key) throw new Error('FAL_KEY is not set');
  fal.config({ credentials: key });
  configured = true;
}

export function isFalConfigured(): boolean {
  return Boolean((process.env.FAL_KEY || '').trim());
}

async function fetchBytes(url: string): Promise<Buffer> {
  const r = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!r.ok) throw new Error(`fal: download failed ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

export async function falGenerateImage(args: {
  prompt: string;
  referenceImageUrl?: string;
  negativePrompt?: string;
}): Promise<Buffer> {
  ensureConfigured();
  const model = args.referenceImageUrl
    ? 'fal-ai/flux-pro/kontext'
    : 'fal-ai/flux-pro/v1.1';
  const input: Record<string, unknown> = {
    prompt: args.prompt,
    image_size: 'landscape_16_9',
    num_inference_steps: 28,
    guidance_scale: 3.5,
    enable_safety_checker: true,
  };
  if (args.referenceImageUrl) input.image_url = args.referenceImageUrl;

  const result = await fal.subscribe(
    model,
    // @ts-expect-error fal SDK exposes per-model typed inputs we don't enumerate
    { input },
  );
  const data = result.data as { images?: { url: string }[] };
  const imageUrl = data.images?.[0]?.url;
  if (!imageUrl) throw new Error('fal: no image returned');
  return fetchBytes(imageUrl);
}

export async function falGenerateVideo(args: {
  prompt: string;
  sourceImageUrl: string;
}): Promise<Buffer> {
  ensureConfigured();
  const videoInput = {
    prompt: args.prompt,
    image_url: args.sourceImageUrl,
    duration: '5',
    aspect_ratio: '9:16',
  } as unknown as Record<string, unknown>;
  const result = await fal.subscribe(
    'fal-ai/kling-video/v2/master/image-to-video',
    // @ts-expect-error fal SDK exposes per-model typed inputs we don't enumerate
    { input: videoInput },
  );
  const data = result.data as { video?: { url: string } };
  const videoUrl = data.video?.url;
  if (!videoUrl) throw new Error('fal: no video returned');
  return fetchBytes(videoUrl);
}
