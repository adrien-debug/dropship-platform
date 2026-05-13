import {
  ShoppingBag,
  Sparkles,
  Leaf,
  HeartPulse,
  Home,
  Smartphone,
  PawPrint,
  Dumbbell,
  Baby,
  Gamepad2,
  Plane,
  Coffee,
  Shirt,
  Sun,
  Droplet,
  Flame,
  Snowflake,
  Music,
  Camera,
  Watch,
  Book,
  Bike,
  type LucideIcon,
} from 'lucide-react';

/**
 * Maps the legacy `logo_emoji` DB field (stored as a single emoji at store
 * creation time) to a Lucide icon. Stores predate the no-emoji rule, so
 * rather than migrate the column we resolve emoji → icon at render time.
 * Anything unmapped falls back to a neutral ShoppingBag.
 */
const EMOJI_TO_ICON: Record<string, LucideIcon> = {
  '🛍': ShoppingBag, '🛍️': ShoppingBag,
  '✨': Sparkles, '🌟': Sparkles, '⭐': Sparkles,
  '🌿': Leaf, '🌱': Leaf, '🍃': Leaf,
  '💄': HeartPulse, '💅': HeartPulse, '💋': HeartPulse,
  '🏠': Home, '🏡': Home,
  '📱': Smartphone, '📲': Smartphone,
  '🐾': PawPrint, '🐶': PawPrint, '🐱': PawPrint,
  '🏋': Dumbbell, '🏋️': Dumbbell, '💪': Dumbbell,
  '👶': Baby, '🍼': Baby,
  '🎮': Gamepad2, '🕹': Gamepad2, '🕹️': Gamepad2,
  '✈': Plane, '✈️': Plane, '🛫': Plane,
  '☕': Coffee, '🍵': Coffee,
  '👕': Shirt, '👔': Shirt, '👗': Shirt,
  '☀': Sun, '☀️': Sun, '🌞': Sun,
  '💧': Droplet, '🌊': Droplet,
  '🔥': Flame,
  '❄': Snowflake, '❄️': Snowflake,
  '🎵': Music, '🎶': Music, '🎧': Music,
  '📷': Camera, '📸': Camera,
  '⌚': Watch, '⏱': Watch,
  '📚': Book, '📖': Book,
  '🚴': Bike, '🚲': Bike,
  '🧘': HeartPulse, '🧘‍♀️': HeartPulse,
};

interface Props {
  /** Raw emoji from the DB (logo_emoji / logoEmoji field). May be empty. */
  emoji?: string | null;
  /** Pixel size of the rendered SVG. */
  size?: number;
  /** Optional Tailwind className for color / spacing. */
  className?: string;
  /** Stroke width override; defaults to 1.5 for the premium thin-line feel. */
  strokeWidth?: number;
}

/**
 * Renders a Lucide icon mapped from a store's `logo_emoji`. Default fallback
 * is `ShoppingBag` so every store always gets a credible mark.
 */
export function StoreLogo({ emoji, size = 24, className, strokeWidth = 1.5 }: Props) {
  const Icon = (emoji && EMOJI_TO_ICON[emoji]) || ShoppingBag;
  return <Icon size={size} strokeWidth={strokeWidth} className={className} aria-hidden />;
}
