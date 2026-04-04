export interface DesignSystemColors {
  primary: string;
  secondary: string;
  background: string;
  foreground: string;
  accent: string;
  muted: string;
  border: string;
  destructive: string;
}

export interface DesignSystemFonts {
  heading: string;
  body: string;
}

export interface DesignSystem {
  id: string;
  name: string;
  description: string;
  audience: string[];
  colors: DesignSystemColors;
  fonts: DesignSystemFonts;
  borderRadius: string;
  darkMode: boolean;
  shadows: boolean;
  animations: boolean;
}
