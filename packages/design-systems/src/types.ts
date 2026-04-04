export interface DesignSystemColors {
  accent: string;
  bg: string;
  bgAlt: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  [key: string]: string;
}

export interface DesignSystemTypography {
  fontPrimary: string;
  fontDisplay?: string;
  fontBody?: string;
  sizeH1: string;
  sizeH2: string;
  sizeH3?: string;
  sizeBody: string;
  weightBlack: string;
  weightBold?: string;
  weightRegular?: string;
  letterSpacingTight?: string;
  letterSpacingWide?: string;
}

export interface DesignSystemSpacing {
  sm: string;
  md: string;
  lg: string;
  xl: string;
}

export interface DesignSystemComponents {
  borderWidth: string;
  radius: string;
  shadow?: string;
  transition: string;
  btnPadding: string;
  [key: string]: string | undefined;
}

export interface DesignSystem {
  id: string;
  num: string;
  name: string;
  category: string;
  description: string;
  audience: string[];
  darkMode: boolean;
  colors: DesignSystemColors;
  typography: DesignSystemTypography;
  spacing: DesignSystemSpacing;
  components: DesignSystemComponents;
}
