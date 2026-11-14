/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: "#21171c",
    tint: "#e84768",

    // Core surfaces
    background: "#f7f2f3",
    foreground: "#21171c",

    // Cards / elevated surfaces
    card: "#ffffff",
    cardForeground: "#21171c",

    // Primary action color (buttons, links, active states)
    primary: "#e84768",
    primaryForeground: "#ffffff",

    // Secondary / less-emphasis interactive surfaces
    secondary: "#eee5e8",
    secondaryForeground: "#34262c",

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: "#eee5e8",
    mutedForeground: "#786a70",

    // Accent highlights (badges, selected items, focus rings)
    accent: "#f8dce3",
    accentForeground: "#6c263d",

    // Discover screen colors stay dark and high-contrast in either theme.
    discoverBackground: "#050506",
    discoverForeground: "#fffaf8",
    discoverMuted: "rgba(255,255,255,0.78)",
    discoverPass: "#df7582",
    discoverSuperLike: "#e4b84f",
    discoverSuperLikeForeground: "#281c08",
    discoverLike: "#ff2d55",
    discoverControl: "rgba(15,12,15,0.42)",
    discoverControlBorder: "rgba(255,255,255,0.3)",
    discoverGradientTop: "rgba(0,0,0,0)",
    discoverGradientMiddle: "rgba(0,0,0,0.28)",
    discoverGradientBottom: "rgba(0,0,0,0.92)",

    // Own profile overview
    profileGradientStart: "#f9c6d3",
    profileGradientMiddle: "#fbd6d8",
    profileGradientEnd: "#fde2cc",
    profileCard: "#fffdfd",
    profileEdit: "#f2557d",
    profileEditForeground: "#fff8fa",
    profileLabel: "#2a2328",
    profileMuted: "#4a4248",
    profileRule: "#efe6e9",
    profileChip: "#fde4ea",
    profileChipForeground: "#a8304f",
    photoBadge: "rgba(0,0,0,0.62)",
    photoBadgeForeground: "#ffffff",
    // Other users' full profile floating actions (screen is always dark)
    publicPassSurface: "rgba(255,250,252,0.92)",
    publicPassIcon: "#e8466a",
    publicToast: "rgba(23,19,23,0.92)",
    publicHeroFade: "rgba(12,10,12,0.35)",
    // Conversation screen (default light reference, with dark chat theme)
    chatBackground: "#fdfbfc",
    chatCard: "#fffefe",
    chatForeground: "#171b33",
    chatMuted: "#6f7180",
    chatBorder: "#ece4e8",
    chatSoft: "#fbeff3",
    chatPink: "#ef5b84",
    chatOnAccent: "#fffefe",
    chatOnline: "#26b36d",
    chatBlue: "#3678d4",
    chatPurple: "#8b5bd5",
    chatGreen: "#238b63",
    chatDarkBackground: "#120e12",
    chatDarkCard: "#1c171c",
    chatDarkForeground: "#fbf5f7",
    chatDarkMuted: "#b6a8af",
    chatDarkBorder: "#332b31",
    chatDarkSoft: "#2a2229",
    chatLightSwatch: "#f4eeee",
    chatSearchHighlight: "#FFD166",
    chatScrim: "rgba(0,0,0,0.42)",
    chatMediaBackdrop: "#050506",
    chatMediaControl: "rgba(0,0,0,0.45)",
    chatSwatchBorder: "rgba(0,0,0,0.12)",

    // Destructive actions (delete, error states)
    destructive: "#d44358",
    destructiveForeground: "#ffffff",

    // Borders and input outlines
    border: "#e3d9dd",
    input: "#e3d9dd",
  },

  dark: {
    text: "#fbf5f7",
    tint: "#ff5376",
    background: "#0c0a0c",
    foreground: "#fbf5f7",
    card: "#171317",
    cardForeground: "#fbf5f7",
    primary: "#ff5376",
    primaryForeground: "#ffffff",
    secondary: "#252025",
    secondaryForeground: "#f7edf1",
    muted: "#252025",
    mutedForeground: "#b6a8af",
    accent: "#3b202b",
    accentForeground: "#ffb1c2",

    // Discover screen colors stay dark and high-contrast in either theme.
    discoverBackground: "#050506",
    discoverForeground: "#fffaf8",
    discoverMuted: "rgba(255,255,255,0.78)",
    discoverPass: "#df7582",
    discoverSuperLike: "#e4b84f",
    discoverSuperLikeForeground: "#281c08",
    discoverLike: "#ff2d55",
    discoverControl: "rgba(15,12,15,0.42)",
    discoverControlBorder: "rgba(255,255,255,0.3)",
    discoverGradientTop: "rgba(0,0,0,0)",
    discoverGradientMiddle: "rgba(0,0,0,0.28)",
    discoverGradientBottom: "rgba(0,0,0,0.92)",

    profileGradientStart: "#3a2232",
    profileGradientMiddle: "#2a1d29",
    profileGradientEnd: "#3a2a26",
    profileCard: "#171317",
    profileEdit: "#f2557d",
    profileEditForeground: "#fff8fa",
    profileLabel: "#efe2e8",
    profileMuted: "#b6a8af",
    profileRule: "#332b31",
    profileChip: "#3b202b",
    profileChipForeground: "#ffb1c2",
    photoBadge: "rgba(0,0,0,0.62)",
    photoBadgeForeground: "#ffffff",
    // Other users' full profile floating actions (screen is always dark)
    publicPassSurface: "rgba(255,250,252,0.92)",
    publicPassIcon: "#e8466a",
    publicToast: "rgba(23,19,23,0.92)",
    publicHeroFade: "rgba(12,10,12,0.35)",
    // Conversation screen (default light reference, with dark chat theme)
    chatBackground: "#fdfbfc",
    chatCard: "#fffefe",
    chatForeground: "#171b33",
    chatMuted: "#6f7180",
    chatBorder: "#ece4e8",
    chatSoft: "#fbeff3",
    chatPink: "#ef5b84",
    chatOnAccent: "#fffefe",
    chatOnline: "#26b36d",
    chatBlue: "#3678d4",
    chatPurple: "#8b5bd5",
    chatGreen: "#238b63",
    chatDarkBackground: "#120e12",
    chatDarkCard: "#1c171c",
    chatDarkForeground: "#fbf5f7",
    chatDarkMuted: "#b6a8af",
    chatDarkBorder: "#332b31",
    chatDarkSoft: "#2a2229",
    chatLightSwatch: "#f4eeee",
    chatSearchHighlight: "#FFD166",
    chatScrim: "rgba(0,0,0,0.42)",
    chatMediaBackdrop: "#050506",
    chatMediaControl: "rgba(0,0,0,0.45)",
    chatSwatchBorder: "rgba(0,0,0,0.12)",

    destructive: "#f05a6e",
    destructiveForeground: "#ffffff",
    border: "#332b31",
    input: "#332b31",
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 8,
};

export default colors;
