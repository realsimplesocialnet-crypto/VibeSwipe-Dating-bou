import colors from "@/constants/colors";
import { useTheme } from "@/hooks/useTheme";

/**
 * Returns the design tokens for the current color scheme.
 *
 * The returned object contains all color tokens for the active palette
 * plus scheme-independent values like `radius`.
 *
 * Falls back to the light palette when no dark key is defined in
 * constants/colors.ts (the scaffold ships light-only by default).
 * When a sibling web artifact's dark tokens are synced into a `dark`
 * key, this hook will automatically switch palettes based on the
 * device's appearance setting.
 */
export function useColors() {
  const { scheme } = useTheme();
  const palette = scheme === "dark" ? colors.dark : colors.light;
  return { ...palette, radius: colors.radius };
}

/** Shared pink brand accent and dark surfaces for the Profile and Likes screens. */
export function usePremiumColors() {
  const base = useColors();
  return {
    ...base,
    background: base.premiumBackground,
    foreground: base.premiumForeground,
    card: base.premiumCard,
    cardForeground: base.premiumForeground,
    primary: base.premiumAccent,
    primaryForeground: base.premiumAccentForeground,
    secondary: base.premiumSoft,
    secondaryForeground: base.premiumForeground,
    muted: base.premiumSoft,
    mutedForeground: base.premiumMuted,
    accent: base.premiumSoft,
    accentForeground: base.premiumAccent,
    border: base.premiumBorder,
    input: base.premiumBorder,
    messagesBackground: base.premiumBackground,
    profileGradientStart: base.premiumBackground,
    profileGradientMiddle: base.premiumBackground,
    profileGradientEnd: base.premiumBackground,
    profileCard: base.premiumCard,
    profileEdit: base.premiumAccent,
    profileEditForeground: base.premiumAccentForeground,
    profileLabel: base.premiumForeground,
    profileMuted: base.premiumMuted,
    profileRule: base.premiumBorder,
    profileChip: base.premiumSoft,
    profileChipForeground: base.premiumAccent,
    publicPassSurface: base.premiumPass,
    publicPassIcon: base.premiumBackground,
    publicToast: base.premiumCard,
    publicHeroFade: base.premiumHeroFade,
    publicHeroBorder: base.premiumHeroBorder,
  };
}
