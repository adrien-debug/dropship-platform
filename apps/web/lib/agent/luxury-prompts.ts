/**
 * Prompt templates for the luxury pipeline.
 *
 * Used by `luxury-pipeline.ts` to re-shoot a commodity dropshipping product
 * as if it were a Hermès / Aesop / Loewe object. The goal is to justify a
 * 15-20x markup through perception alone: lighting, framing, materials
 * vocabulary, packaging, copy voice.
 *
 * Anti-patterns we explicitly steer the generator away from:
 *   - AliExpress photography (white background, harsh flash, plastic feel)
 *   - "Buy now / Limited stock" urgency copy
 *   - Dropshipping clichés (free shipping badges, percent-off stickers)
 *   - Plastic textures, garish colors, neon CTAs
 *
 * Everything is parameterised by `LuxuryBrandContext` so the same prompts
 * work across niches (jewelry, leather goods, beauty, home, accessories).
 */

export interface LuxuryBrandContext {
  storeName: string;
  productName: string;
  niche: string;
  /** Hex string, e.g. "#7a5c3a". Used to thread a brand accent through
   *  scenes and packaging. */
  accentColor: string;
  /** Optional one-sentence positioning (used in the copy prompts). */
  positioning?: string;
  /** Reference image URL (the supplier shot — kontext model uses this as
   *  the structural anchor when rendering). */
  referenceImageUrl?: string;
}

const PALETTE_MOOD =
  'palette : ivoire, charbon, beige sable, ombres profondes, accents discrets, jamais saturé';

const STUDIO_LIGHT =
  'éclairage studio softbox latérale, ombre douce, reflets mats, contraste maîtrisé, grain photo argentique léger';

/**
 * Hero shot — full-bleed image for the storefront top.
 * Single product, dramatic lighting, generous negative space.
 */
export function luxuryHeroPrompt(ctx: LuxuryBrandContext): string {
  return [
    `Photographie éditoriale haut de gamme de "${ctx.productName}",`,
    `mise en scène cinématographique sur fond de marbre ${tintFromAccent(ctx.accentColor)} ou plâtre brut neutre,`,
    STUDIO_LIGHT,
    PALETTE_MOOD,
    'cadrage 16:9 generous negative space, profondeur de champ réduite,',
    'composition asymétrique inspirée de Hermès / Loewe / Aesop,',
    `accent ${ctx.accentColor} subtil dans un reflet ou une ombre, jamais en aplat,`,
    'rendu ultra-réaliste, texture matérielle visible, niveau magazine de luxe.',
  ].join(' ');
}

/**
 * Cutout — the product alone on a neutral seamless background, used in
 * the storefront's "Atelier" section and as the OG image. No lifestyle
 * context, just the object speaking for itself.
 */
export function luxuryCutoutPrompt(ctx: LuxuryBrandContext): string {
  return [
    `Photographie produit de "${ctx.productName}" sur fond seamless neutre ivoire (RAL 9001),`,
    'éclairage 3 points studio, softbox principale 45° gauche, fill réflecteur droite,',
    'ombre portée douce et nette, sans réflexion parasite,',
    'cadrage frontal légèrement plongé, produit centré, marges généreuses,',
    PALETTE_MOOD,
    'rendu hyper-réaliste, texture matérielle parfaitement lisible, niveau catalogue maison de luxe.',
  ].join(' ');
}

/**
 * Lifestyle — the product in context. Three different mood angles so the
 * storefront triptych section feels considered, not generic stock.
 */
export function luxuryLifestylePrompts(ctx: LuxuryBrandContext): string[] {
  const baseScene = sceneAnchorForNiche(ctx.niche);
  return [
    [
      `Scène lifestyle minimale : "${ctx.productName}" posé sur une surface en bois clair noueux,`,
      `dans ${baseScene.intimate}, lumière naturelle filtrée par un rideau de lin,`,
      'composition rule of thirds, profondeur de champ marquée, grain argentique,',
      PALETTE_MOOD,
      'esthétique slow living, sensation matérielle, niveau magazine Kinfolk / Wallpaper.',
    ].join(' '),
    [
      `Scène lifestyle : "${ctx.productName}" en main, gros plan main et objet,`,
      `peau caucasienne neutre, manche en lin écru, ${baseScene.handheld},`,
      'flou en arrière-plan, lumière directionnelle douce de fin de journée,',
      PALETTE_MOOD,
      'récit haptique, sensation de prise en main premium, rendu cinéma sur film.',
    ].join(' '),
    [
      `Scène lifestyle : détail macro de "${ctx.productName}" mettant en valeur sa finition,`,
      'gros plan sur la couture / la matière / l\'arête, lumière rasante,',
      `${baseScene.detail}, fond hors-focus,`,
      PALETTE_MOOD,
      'révèle l\'attention portée au geste artisanal, niveau ad campaign Bottega Veneta.',
    ].join(' '),
  ];
}

/**
 * Packaging — the unboxing reveal. A signature box, branded sleeve, or
 * pouch staged as a still life. This is the asset that singularly justifies
 * the 15-20x markup ("I am paying for the ceremony, not the object").
 */
export function luxuryPackagingPrompt(ctx: LuxuryBrandContext): string {
  return [
    `Photographie produit d'un coffret cadeau premium signé "${ctx.storeName}",`,
    'boîte mate en carton épais ivoire ou kraft fin, embossage discret du nom de marque,',
    `ruban en gros-grain ${tintFromAccent(ctx.accentColor)}, sceau de cire ou étiquette manuscrite,`,
    `mis en scène avec le produit "${ctx.productName}" partiellement révélé,`,
    'composition still life sur surface en chêne huilé ou marbre veiné neutre,',
    STUDIO_LIGHT,
    'cadrage légèrement plongé, profondeur de champ douce,',
    'esthétique unboxing maison de luxe, niveau Hermès Petit H / Le Labo / Aesop gift set,',
    PALETTE_MOOD,
    'rendu ultra-réaliste, texture du papier et du tissu parfaitement visibles.',
  ].join(' ');
}

/**
 * Video hero — 5s cinematic loop, vertical 9:16 (works on mobile + can be
 * letterboxed for desktop). Slow camera move on the static product, dust
 * particles in the light, no quick cuts.
 */
export function luxuryVideoPrompt(ctx: LuxuryBrandContext): string {
  return [
    `Plan cinéma 5 secondes : "${ctx.productName}" en très lent travelling avant,`,
    'caméra glisse de 30cm vers le sujet, profondeur de champ qui se resserre,',
    'particules de poussière visibles dans la lumière oblique du studio,',
    STUDIO_LIGHT,
    PALETTE_MOOD,
    'sans coupe, sans transition, mood méditatif, niveau ad film Hermès / Aesop.',
  ].join(' ');
}

/**
 * Copy generator system prompt — fed to Claude. Produces the storefront's
 * literary copy (hero lede, story, atelier copy, packaging blurb, CTA).
 * Output is strict JSON for the caller to validate.
 */
export function luxuryCopySystemPrompt(): string {
  return [
    'You are the copywriter for a maison of luxury craft, writing in French.',
    'Voice: literary, restrained, hand-made, slow. Read like Hermès / Aesop / Le Labo / Loewe — never like a dropshipping store.',
    'Never use: dropshipping vocabulary, urgency tactics ("dernière chance", "promotion", "stock limité"), em-dashes, three-beat triads ("vite, bien, pas cher"), exclamation marks, generic SaaS adjectives ("incroyable", "révolutionnaire", "innovant").',
    'Always use: concrete material vocabulary, sensory detail (texture, weight, sound, finish), restrained syntax (one idea per sentence), patience as a value.',
    'Frame the price as fair compensation for craft and time, never as a deal. Frame the wait (made-to-order 6-8 weeks) as a feature, not an apology.',
    'Output strict JSON matching the schema given in the user message. No prose around the JSON. No code fences.',
  ].join(' ');
}

export interface LuxuryCopyOutput {
  /** Eyebrow line above the hero headline. Short, e.g. "Édition numérotée · Pièce signature". */
  hero_eyebrow: string;
  /** The lede paragraph under the hero name. 2-3 short sentences. */
  hero_lede: string;
  /** The story section opener (h3) — 1 sentence, declarative. */
  story_headline: string;
  /** Two paragraphs of story prose for the 2-col layout. */
  story_body: [string, string];
  /** The three "atelier" / "craft" pillars. Each: a one-word title + a 1-2 sentence body. */
  atelier_pillars: Array<{ title: string; body: string }>;
  /** The line that introduces the price in the atelier section. */
  price_rationale: string;
  /** The packaging section headline. */
  packaging_headline: string;
  /** The packaging section body — 1 short paragraph. */
  packaging_body: string;
  /** The final CTA section sub-line (under the price reveal). */
  final_cta_note: string;
}

/**
 * Build the user message that asks Claude to produce the luxury copy for
 * a given product/store context. The schema is repeated in the message
 * so Claude returns the exact shape we expect.
 */
export function luxuryCopyUserPrompt(ctx: LuxuryBrandContext & {
  /** Original product description from the supplier — Claude rewrites this
   *  in luxury voice, doesn't quote it. */
  supplierDescription?: string;
  /** Price the operator will charge (in euros, the high price, not the
   *  AliExpress cost). Used so Claude can frame the rationale honestly. */
  priceEuros?: number;
}): string {
  return [
    `Maison : ${ctx.storeName}`,
    `Pièce : ${ctx.productName}`,
    `Univers : ${ctx.niche}`,
    ctx.positioning ? `Positionnement : ${ctx.positioning}` : null,
    ctx.priceEuros ? `Prix de vente : ${ctx.priceEuros} €` : null,
    ctx.supplierDescription
      ? `Source à reformuler (NE PAS reprendre tel quel) : ${ctx.supplierDescription.slice(0, 800)}`
      : null,
    '',
    'Produis un JSON strict respectant ce schéma :',
    JSON.stringify(
      {
        hero_eyebrow: 'string (≤60 chars)',
        hero_lede: 'string (≤220 chars, 2-3 phrases)',
        story_headline: 'string (≤120 chars)',
        story_body: ['string (≤320 chars)', 'string (≤320 chars)'],
        atelier_pillars: [
          { title: 'string (1-2 mots)', body: 'string (≤200 chars)' },
          { title: 'string (1-2 mots)', body: 'string (≤200 chars)' },
          { title: 'string (1-2 mots)', body: 'string (≤200 chars)' },
        ],
        price_rationale: 'string (≤200 chars)',
        packaging_headline: 'string (≤120 chars)',
        packaging_body: 'string (≤280 chars)',
        final_cta_note: 'string (≤180 chars)',
      },
      null,
      2,
    ),
    '',
    'Rappels : voix littéraire, voix maison, jamais dropshipping, jamais d\'em-dash, jamais d\'urgence promo. Tout en français.',
  ]
    .filter(Boolean)
    .join('\n');
}

// ── helpers ─────────────────────────────────────────────────────────────

/**
 * Returns a French color-name hint for use inside prompts ("marbre veiné
 * de sable") so the generator picks a backdrop that complements the brand
 * accent. We deliberately stay in earthy / muted vocabulary even for vivid
 * accents — the backdrop should never compete with the product.
 */
function tintFromAccent(hex: string): string {
  const h = hex.replace('#', '').toLowerCase();
  if (h.length !== 6) return 'sable';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  // Near-neutral (low chroma) → ivory tones
  if (max - min < 24) return 'ivoire / craie';
  // Warm-dominant
  if (r >= g && r >= b) return g > b ? 'sable / kraft' : 'terre cuite / cuir';
  // Cool-dominant
  if (b >= r && b >= g) return 'ardoise / bleuté minéral';
  return 'lichen / pierre verdie';
}

/**
 * Niche-aware scene anchors used in the lifestyle prompts. These keep the
 * three shots feeling like *the same brand's editorial campaign* rather
 * than three random stock photos.
 */
function sceneAnchorForNiche(niche: string): {
  intimate: string;
  handheld: string;
  detail: string;
} {
  const n = niche.toLowerCase();
  if (/bijou|jewel|ring|bracelet|collier/.test(n)) {
    return {
      intimate: 'un coffret vide en velours sombre ouvert à côté',
      handheld: 'doigts tenant la pièce contre une fenêtre lumineuse',
      detail: 'la pierre / le métal en gros plan révélant la patine',
    };
  }
  if (/skin|cosm|beaut|soin|sérum|huile|crème/.test(n)) {
    return {
      intimate: 'une salle de bain en travertin avec serviettes en lin froissé',
      handheld: 'la pipette en suspension au-dessus de la peau',
      detail: 'la texture du sérum qui s\'étale sur l\'avant-bras',
    };
  }
  if (/cuir|leather|sac|maroquin|portefeuille/.test(n)) {
    return {
      intimate: 'une chaise en chêne avec un manteau en laine drapé',
      handheld: 'la bandoulière passée sur l\'épaule, marche dans une rue pavée',
      detail: 'le grain du cuir, la couture sellier à la main',
    };
  }
  if (/maison|home|déco|interior|bougie|candle/.test(n)) {
    return {
      intimate: 'un salon ouvert avec un mur en chaux et un fauteuil en bouclette',
      handheld: 'la main allumant une mèche, fumée fine qui monte',
      detail: 'la cire qui fond, le reflet de la flamme sur la matière',
    };
  }
  if (/chien|chat|pet|animal|dog|cat/.test(n)) {
    return {
      intimate: 'un coin lecture avec un golden retriever endormi sur un tapis en laine',
      handheld: 'la main qui caresse l\'animal pendant qu\'il utilise l\'objet',
      detail: 'le pelage de l\'animal et la matière de l\'objet en contact',
    };
  }
  // Generic default
  return {
    intimate: 'un intérieur minimaliste avec un livre ouvert et une tasse en grès',
    handheld: 'les mains qui tiennent la pièce à hauteur de poitrine',
    detail: 'la finition / la couture / la matière en gros plan',
  };
}
