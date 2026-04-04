const COMFYUI_URL = process.env.COMFYUI_URL || 'http://100.88.191.49:8188';

export async function generateProductImage(prompt: string, options?: {
  width?: number;
  height?: number;
  steps?: number;
}): Promise<Buffer> {
  const workflow = buildWorkflow(prompt, options);
  
  const promptRes = await fetch(`${COMFYUI_URL}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow }),
  });
  if (!promptRes.ok) throw new Error(`ComfyUI prompt error: ${promptRes.status}`);
  const { prompt_id } = (await promptRes.json()) as { prompt_id: string };

  let result: Record<string, unknown> | null = null;
  for (let i = 0; i < 120; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const historyRes = await fetch(`${COMFYUI_URL}/history/${prompt_id}`);
    const history = (await historyRes.json()) as Record<
      string,
      { outputs?: Record<string, unknown> }
    >;
    if (history[prompt_id]?.outputs) {
      result = history[prompt_id].outputs;
      break;
    }
  }
  if (!result) throw new Error('ComfyUI generation timed out');

  const outputNode = Object.values(result).find((n: unknown) => {
    const node = n as Record<string, unknown>;
    return node.images && Array.isArray(node.images);
  }) as { images: { filename: string; subfolder: string; type: string }[] } | undefined;
  
  if (!outputNode?.images?.[0]) throw new Error('No image generated');
  const img = outputNode.images[0];
  const imgRes = await fetch(`${COMFYUI_URL}/view?filename=${img.filename}&subfolder=${img.subfolder}&type=${img.type}`);
  return Buffer.from(await imgRes.arrayBuffer());
}

function buildWorkflow(prompt: string, options?: { width?: number; height?: number; steps?: number }) {
  return {
    "3": {
      class_type: "KSampler",
      inputs: {
        seed: Math.floor(Math.random() * 1e15),
        steps: options?.steps ?? 25,
        cfg: 7,
        sampler_name: "euler",
        scheduler: "normal",
        denoise: 1,
        model: ["4", 0],
        positive: ["6", 0],
        negative: ["7", 0],
        latent_image: ["5", 0],
      },
    },
    "4": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: "sd_xl_base_1.0.safetensors" } },
    "5": { class_type: "EmptyLatentImage", inputs: { width: options?.width ?? 1024, height: options?.height ?? 1024, batch_size: 1 } },
    "6": { class_type: "CLIPTextEncode", inputs: { text: `professional product photo, white background, ${prompt}, high quality, 4k`, clip: ["4", 1] } },
    "7": { class_type: "CLIPTextEncode", inputs: { text: "blurry, low quality, text, watermark, logo", clip: ["4", 1] } },
    "8": { class_type: "VAEDecode", inputs: { samples: ["3", 0], vae: ["4", 2] } },
    "9": { class_type: "SaveImage", inputs: { filename_prefix: "dropship", images: ["8", 0] } },
  };
}
