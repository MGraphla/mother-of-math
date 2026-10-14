import { Dimensions, PixelRatio, Platform } from "react-native";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

/**
 * Colours are resolved from the web app's CSS variables in src/index.css so the
 * two apps render the same brand. HSL source values are noted next to each one.
 */
export const colors = {
  // --primary: 144 100% 31%
  brand: "#009E3F",
  brandDark: "#008033",
  brandDeep: "#006629",
  brandTint: "#F2FAF5",
  brandSoft: "#E6F5EC",
  brandMute: "#CCECD9",
  // --secondary: 34 46% 20%
  secondary: "#4A361B",
  secondaryDark: "#33250F",

  // --background / --card / --border / --foreground / --muted-foreground
  bg: "#F6F8FA",
  bgSunken: "#F1F3F6",
  surface: "#FFFFFF",
  border: "#E4E4E7",
  borderStrong: "#D4D4D8",
  text: "#22222A",
  textSecondary: "#3F3F46",
  textMuted: "#71717A",
  textFaint: "#A1A1AA",

  // --destructive: 0 84.2% 60.2%
  danger: "#EF4444",
  dangerSoft: "#FEF2F2",
  dangerBorder: "#FECACA",
  dangerText: "#B91C1C",

  amber: "#F59E0B",
  amberSoft: "#FFFBEB",
  amberBorder: "#FDE68A",
  amberText: "#B45309",
  emerald: "#10B981",
  emeraldSoft: "#ECFDF5",
  emeraldBorder: "#A7F3D0",
  emeraldText: "#047857",
  blue: "#3B82F6",
  blueSoft: "#EFF6FF",
  blueBorder: "#BFDBFE",
  blueText: "#1D4ED8",
  violet: "#8B5CF6",
  violetSoft: "#F5F3FF",
  violetText: "#6D28D9",
  yellow: "#EAB308",
  chartBar: "#22C55E",

  gray50: "#F9FAFB",
  gray100: "#F3F4F6",
  gray200: "#E5E7EB",
  gray300: "#D1D5DB",
  gray400: "#9CA3AF",
  gray500: "#6B7280",
  gray700: "#374151",
  gray800: "#1F2937",
  gray900: "#111827",

  white: "#FFFFFF",
  overlay: "rgba(15, 23, 42, 0.55)",

  /** Translucent whites used on top of the green sidebar, mirroring bg-white/xx. */
  onBrand: "#FFFFFF",
  onBrandMuted: "rgba(255,255,255,0.80)",
  onBrandFaint: "rgba(255,255,255,0.60)",
  onBrandActive: "rgba(255,255,255,0.20)",
  onBrandHover: "rgba(255,255,255,0.12)",
  onBrandBorder: "rgba(255,255,255,0.16)",
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const;

/** --radius is 1rem on the web; shadcn derives md/sm from it. */
export const radius = {
  xs: 6,
  sm: 10,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 999,
} as const;

/**
 * Android ignores fontWeight when a custom fontFamily is set, so weight has to be
 * expressed as a distinct family. Always go through <Text> from src/ui.
 */
export const fonts = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extrabold: "Inter_800ExtraBold",
  black: "Inter_900Black",
} as const;

export type FontWeightName = keyof typeof fonts;

const isSmall = SCREEN_W < 360;

export const typography = {
  /** First-screen / splash display type — oversized on purpose. */
  display: { fontSize: isSmall ? 46 : 56, lineHeight: isSmall ? 50 : 60, letterSpacing: -1.8 },
  hero: { fontSize: isSmall ? 32 : 38, lineHeight: isSmall ? 36 : 44, letterSpacing: -0.9 },
  h1: { fontSize: isSmall ? 22 : 26, lineHeight: isSmall ? 28 : 32, letterSpacing: -0.4 },
  h2: { fontSize: isSmall ? 19 : 21, lineHeight: 27, letterSpacing: -0.3 },
  h3: { fontSize: 17, lineHeight: 24, letterSpacing: -0.2 },
  title: { fontSize: isSmall ? 20 : 22, lineHeight: 28, letterSpacing: -0.3 },
  subtitle: { fontSize: 15, lineHeight: 21 },
  body: { fontSize: 15, lineHeight: 22 },
  bodySm: { fontSize: 14, lineHeight: 20 },
  caption: { fontSize: 13, lineHeight: 18 },
  micro: { fontSize: 11, lineHeight: 15 },
  label: { fontSize: 12, lineHeight: 16, letterSpacing: 0.4 },
  stat: { fontSize: isSmall ? 26 : 30, lineHeight: 36, letterSpacing: -0.8 },
} as const;

export const layout = {
  screenWidth: SCREEN_W,
  screenHeight: SCREEN_H,
  isSmallPhone: isSmall,
  isCompactHeight: SCREEN_H < 700,
  /** Tablets get a centred column instead of stretched-out rows. */
  contentMaxWidth: Math.min(SCREEN_W, 640),
  hitSlop: { top: 10, bottom: 10, left: 10, right: 10 },
  hairline: 1 / PixelRatio.get(),
  keyboardOffset: Platform.OS === "ios" ? 12 : 0,
  /** Matches the web dashboard header (h-16) and sidebar (w-72). */
  headerHeight: 60,
  drawerWidth: Math.min(300, SCREEN_W * 0.84),
  minTouch: 44,
} as const;

const platformShadow = (
  opacity: number,
  radiusValue: number,
  offsetY: number,
  elevation: number,
) =>
  Platform.select({
    ios: {
      shadowColor: "#0F172A",
      shadowOpacity: opacity,
      shadowRadius: radiusValue,
      shadowOffset: { width: 0, height: offsetY },
    },
    android: { elevation },
    default: {},
  }) as object;

export const shadow = {
  none: {},
  xs: platformShadow(0.04, 4, 1, 1),
  card: platformShadow(0.06, 10, 4, 2),
  md: platformShadow(0.09, 16, 6, 4),
  lg: platformShadow(0.14, 24, 10, 8),
  drawer: platformShadow(0.22, 28, 0, 16),
} as const;
