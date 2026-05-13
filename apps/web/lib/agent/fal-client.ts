import { fal } from '@fal-ai/client';

/**
 * fal.ai fallback for asset generation. Used when ComfyUI isn't configured
 * (no COMFY_DEPLOY_API_KEY / no deployment IDs) but FAL_KEY is set.
 *
 * Model choices (locked here so the rest of the pipeline doesn't care):
 *   - Hero: `fal-ai/flux-pro/v1.1-ultra` (2752×1536 native 4MP) then
 *     `fal-ai/clarity-upscaler` 2× → ~5500×3072. Needed because the hero is
 *     displayed full-bleed; standard 1024-wide renders look pixelated on 4K.
 *   - Cutout + lifestyles: `fal-ai/flux-pro/kontext` (with supplier ref image)
 *     or `fal-ai/flux-pro/v1.1` otherwise. landscape_16_9 preset is fine here
 *     because these assets are displayed at smaller sizes.
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
  /** Hint to the generator that this is the hero image and deserves
   *  the higher-quality (slower, costlier) settings. Lifestyles and
   *  cutouts stay on the standard preset. */
  quality?: 'standard' | 'hero';
}): Promise<Buffer> {
  ensureConfigured();
  const hero = args.quality === 'hero';

  // Hero path: flux-pro/v1.1-ultra renders natively at 2752×1536 (4MP),
  // then Clarity Upscaler 2× brings it to ~5500×3072 for crisp full-bleed
  // display on 4K retina screens. Total cost ~0.07€/hero vs ~0.02€ standard.
  // The reference image is dropped on this path — ultra doesn't support
  // image-to-image, but the editorial prompt already carries enough context.
  if (hero) {
    const ultraUrl = await falUltraGenerate(args.prompt);
    return falClarityUpscale(ultraUrl);
  }

  // Standard path (cutout + 3 lifestyles): kontext when we have a reference
  // photo of the supplier product, plain v1.1 otherwise.
  const model = args.referenceImageUrl
    ? 'fal-ai/flux-pro/kontext'
    : 'fal-ai/flux-pro/v1.1';
  const input: Record<string, unknown> = {
    prompt: args.prompt,
    image_size: 'landscape_16_9',
    num_inference_steps: 32,
    guidance_scale: 3.5,
    output_format: 'png',
    safety_tolerance: '2',
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

/**
 * Render with `fal-ai/flux-pro/v1.1-ultra`. Returns the hosted URL (not bytes)
 * because the next step (Clarity Upscaler) wants a URL as input — saves one
 * download/upload round-trip.
 */
async function falUltraGenerate(prompt: string): Promise<string> {
  const result = await fal.subscribe('fal-ai/flux-pro/v1.1-ultra', {
    input: {
      prompt,
      aspect_ratio: '16:9',
      output_format: 'png',
      safety_tolerance: '2',
      raw: false,
    },
  });
  const data = result.data as { images?: { url: string }[] };
  const url = data.images?.[0]?.url;
  if (!url) throw new Error('fal: no ultra image returned');
  return url;
}

/**
 * 2× upscale via `fal-ai/clarity-upscaler`. Preserves fine detail (skin,
 * fabric, product textures) without the smeared-plastic look of naive ESRGAN.
 * Falls back to fetching the source URL if the upscaler fails — better to
 * ship a 2752px hero than no hero at all.
 */
async function falClarityUpscale(imageUrl: string): Promise<Buffer> {
  try {
    const result = await fal.subscribe('fal-ai/clarity-upscaler', {
      input: {
        image_url: imageUrl,
        upscale_factor: 2,
        creativity: 0.35,
        resemblance: 0.6,
        guidance_scale: 4,
        num_inference_steps: 18,
      },
    });
    const data = result.data as { image?: { url: string } };
    const upscaledUrl = data.image?.url;
    if (!upscaledUrl) throw new Error('fal: no upscaled image returned');
    return fetchBytes(upscaledUrl);
  } catch (err) {
    // Clarity sometimes times out or refuses on edge content. Don't fail
    // the whole store creation over the upscale — the 2752px ultra render
    // is already sharp enough for most viewports.
    console.warn('[fal] clarity upscale failed, falling back to ultra-only:', err);
    return fetchBytes(imageUrl);
  }
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
