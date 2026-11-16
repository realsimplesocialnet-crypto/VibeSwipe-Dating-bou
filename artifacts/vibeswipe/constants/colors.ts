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
    tint: "#F34E9A",

    // Core surfaces
    background: "#f7f2f3",
    foreground: "#21171c",

    // Cards / elevated surfaces
    card: "#ffffff",
    cardForeground: "#21171c",

    // Primary action color (buttons, links, active states)
    primary: "#F34E9A",
    primaryForeground: "#24111b",

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
    discoverBackground: "#0F0F12",
    discoverForeground: "#fff7fb",
    discoverMuted: "rgba(255,255,255,0.78)",
    discoverPass: "#A9A49A",
    discoverSuperLike: "#F34E9A",
    discoverSuperLikeForeground: "#24111b",
    discoverLike: "#F34E9A",
    discoverControl: "rgba(15,12,15,0.42)",
    discoverControlBorder: "rgba(255,255,255,0.3)",
    discoverGradientTop: "rgba(0,0,0,0)",
    discoverGradientMiddle: "rgba(0,0,0,0.28)",
    discoverGradientBottom: "rgba(0,0,0,0.92)",

    // Own profile overview
    messagesBackground: "#ffedf1",
    profileGradientStart: "#f9c6d3",
    profileGradientMiddle: "#fbd6d8",
    profileGradientEnd: "#fde2cc",
    profileCard: "#fffdfd",
    profileEdit: "#F34E9A",
    profileEditForeground: "#24111b",
    profileLabel: "#2a2328",
    profileMuted: "#4a4248",
    profileRule: "#efe6e9",
    profileChip: "#fde4ea",
    profileChipForeground: "#a8304f",
    premiumBackground: "#0F0F12",
    premiumCard: "#1A1A1E",
    premiumAccent: "#F34E9A",
    premiumAccentForeground: "#24111b",
    premiumForeground: "#fbf5f7",
    premiumMuted: "#b6a8af",
    premiumBorder: "#332b31",
    premiumSoft: "#3b202b",
    premiumPass: "#f4eeee",
    premiumHeroFade: "rgba(0,0,0,0.48)",
    premiumHeroBorder: "rgba(243,78,154,0.22)",
    photoBadge: "rgba(0,0,0,0.62)",
    photoBadgeForeground: "#ffffff",
    // Other users' full profile floating actions (screen is always dark)
    publicPassSurface: "rgba(255,250,252,0.92)",
    publicPassIcon: "#F34E9A",
    publicToast: "rgba(23,19,23,0.92)",
    publicHeroFade: "rgba(12,10,12,0.35)",
    // Conversation screen (default light reference, with dark chat theme)
    chatBackground: "#fdfbfc",
    chatCard: "#fffefe",
    chatForeground: "#171b33",
    chatMuted: "#6f7180",
    chatBorder: "#ece4e8",
    chatSoft: "#fbeff3",
    chatPink: "#F34E9A",
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
    chatSearchHighlight: "#F34E9A",
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
    tint: "#F34E9A",
    background: "#0F0F12",
    foreground: "#fbf5f7",
    card: "#1A1A1E",
    cardForeground: "#fbf5f7",
    primary: "#F34E9A",
    primaryForeground: "#24111b",
    secondary: "#252025",
    secondaryForeground: "#f7edf1",
    muted: "#252025",
    mutedForeground: "#b6a8af",
    accent: "#3b202b",
    accentForeground: "#ffb1c2",

    // Discover screen colors stay dark and high-contrast in either theme.
    discoverBackground: "#0F0F12",
    discoverForeground: "#fff7fb",
    discoverMuted: "rgba(255,255,255,0.78)",
    discoverPass: "#A9A49A",
    discoverSuperLike: "#F34E9A",
    discoverSuperLikeForeground: "#24111b",
    discoverLike: "#F34E9A",
    discoverControl: "rgba(15,12,15,0.42)",
    discoverControlBorder: "rgba(255,255,255,0.3)",
    discoverGradientTop: "rgba(0,0,0,0)",
    discoverGradientMiddle: "rgba(0,0,0,0.28)",
    discoverGradientBottom: "rgba(0,0,0,0.92)",

    messagesBackground: "#0F0F12",
    profileGradientStart: "#0F0F12",
    profileGradientMiddle: "#0F0F12",
    profileGradientEnd: "#0F0F12",
    profileCard: "#1A1A1E",
    profileEdit: "#F34E9A",
    profileEditForeground: "#24111b",
    profileLabel: "#efe2e8",
    profileMuted: "#b6a8af",
    profileRule: "#332b31",
    profileChip: "#3b202b",
    profileChipForeground: "#ffb1c2",
    premiumBackground: "#0F0F12",
    premiumCard: "#1A1A1E",
    premiumAccent: "#F34E9A",
    premiumAccentForeground: "#24111b",
    premiumForeground: "#fbf5f7",
    premiumMuted: "#b6a8af",
    premiumBorder: "#332b31",
    premiumSoft: "#3b202b",
    premiumPass: "#f4eeee",
    premiumHeroFade: "rgba(0,0,0,0.48)",
    premiumHeroBorder: "rgba(243,78,154,0.22)",
    photoBadge: "rgba(0,0,0,0.62)",
    photoBadgeForeground: "#ffffff",
    // Other users' full profile floating actions (screen is always dark)
    publicPassSurface: "rgba(255,250,252,0.92)",
    publicPassIcon: "#F34E9A",
    publicToast: "rgba(23,19,23,0.92)",
    publicHeroFade: "rgba(12,10,12,0.35)",
    // Conversation screen (default light reference, with dark chat theme)
    chatBackground: "#fdfbfc",
    chatCard: "#fffefe",
    chatForeground: "#171b33",
    chatMuted: "#6f7180",
    chatBorder: "#ece4e8",
    chatSoft: "#fbeff3",
    chatPink: "#F34E9A",
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
    chatSearchHighlight: "#F34E9A",
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
