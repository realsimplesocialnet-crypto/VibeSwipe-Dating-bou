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
    text: "#111111",
    tint: "#111111",

    // Core surfaces
    background: "#F5F5F5",
    foreground: "#111111",

    // Cards / elevated surfaces
    card: "#FFFFFF",
    cardForeground: "#111111",

    // Primary action color (buttons, links, active states)
    primary: "#111111",
    primaryForeground: "#FFFFFF",

    // Secondary / less-emphasis interactive surfaces
    secondary: "#EAEAEA",
    secondaryForeground: "#111111",

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: "#EEEEEE",
    mutedForeground: "#666666",

    // Accent highlights (badges, selected items, focus rings)
    accent: "#E8E8E8",
    accentForeground: "#111111",

    // Discover screen colors stay dark and high-contrast in either theme.
    discoverBackground: "#0F0F12",
    discoverForeground: "#FFFFFF",
    discoverMuted: "rgba(255,255,255,0.78)",
    discoverPass: "#A0A0A0",
    discoverSuperLike: "#FFFFFF",
    discoverSuperLikeForeground: "#111111",
    discoverLike: "#FFFFFF",
    discoverControl: "rgba(15,12,15,0.42)",
    discoverControlBorder: "rgba(255,255,255,0.3)",
    discoverGradientTop: "rgba(0,0,0,0)",
    discoverGradientMiddle: "rgba(0,0,0,0.28)",
    discoverGradientBottom: "rgba(0,0,0,0.92)",

    // Own profile overview
    messagesBackground: "#F5F5F5",
    profileGradientStart: "#F5F5F5",
    profileGradientMiddle: "#F5F5F5",
    profileGradientEnd: "#FFFFFF",
    profileCard: "#FFFFFF",
    profileEdit: "#111111",
    profileEditForeground: "#FFFFFF",
    profileLabel: "#111111",
    profileMuted: "#666666",
    profileRule: "#E5E5E5",
    profileChip: "#EEEEEE",
    profileChipForeground: "#111111",
    premiumBackground: "#F5F5F5",
    premiumCard: "#FFFFFF",
    premiumAccent: "#111111",
    premiumAccentForeground: "#FFFFFF",
    premiumForeground: "#111111",
    premiumMuted: "#666666",
    premiumBorder: "#E5E5E5",
    premiumSoft: "#EEEEEE",
    premiumPass: "#FFFFFF",
    premiumHeroFade: "rgba(0,0,0,0.48)",
    premiumHeroBorder: "rgba(17,17,17,0.14)",
    photoBadge: "rgba(0,0,0,0.62)",
    photoBadgeForeground: "#ffffff",
    // Other users' full profile floating actions (screen is always dark)
    publicPassSurface: "rgba(255,255,255,0.92)",
    publicPassIcon: "#111111",
    publicToast: "rgba(23,19,23,0.92)",
    publicHeroFade: "rgba(12,10,12,0.35)",
    // Conversation screen (default light reference, with dark chat theme)
    chatBackground: "#FFFFFF",
    chatCard: "#FFFFFF",
    chatForeground: "#111111",
    chatMuted: "#666666",
    chatBorder: "#E5E5E5",
    chatSoft: "#F2F2F2",
    chatPink: "#111111",
    chatOnAccent: "#FFFFFF",
    chatOnline: "#555555",
    chatBlue: "#303030",
    chatPurple: "#555555",
    chatGreen: "#777777",
    chatDarkBackground: "#000000",
    chatDarkCard: "#111111",
    chatDarkForeground: "#FFFFFF",
    chatDarkMuted: "#B8B8B8",
    chatDarkBorder: "#333333",
    chatDarkSoft: "#222222",
    chatLightSwatch: "#F2F2F2",
    chatSearchHighlight: "#111111",
    chatScrim: "rgba(0,0,0,0.42)",
    chatMediaBackdrop: "#050506",
    chatMediaControl: "rgba(0,0,0,0.45)",
    chatSwatchBorder: "rgba(0,0,0,0.12)",

    // Destructive actions (delete, error states)
    destructive: "#d44358",
    destructiveForeground: "#ffffff",

    // Borders and input outlines
    border: "#E5E5E5",
    input: "#E5E5E5",
  },

  dark: {
    text: "#FFFFFF",
    tint: "#FFFFFF",
    background: "#000000",
    foreground: "#FFFFFF",
    card: "#111111",
    cardForeground: "#FFFFFF",
    primary: "#FFFFFF",
    primaryForeground: "#111111",
    secondary: "#222222",
    secondaryForeground: "#FFFFFF",
    muted: "#1A1A1A",
    mutedForeground: "#B8B8B8",
    accent: "#222222",
    accentForeground: "#FFFFFF",

    // Discover screen colors stay dark and high-contrast in either theme.
    discoverBackground: "#0F0F12",
    discoverForeground: "#FFFFFF",
    discoverMuted: "rgba(255,255,255,0.78)",
    discoverPass: "#A0A0A0",
    discoverSuperLike: "#FFFFFF",
    discoverSuperLikeForeground: "#111111",
    discoverLike: "#FFFFFF",
    discoverControl: "rgba(15,12,15,0.42)",
    discoverControlBorder: "rgba(255,255,255,0.3)",
    discoverGradientTop: "rgba(0,0,0,0)",
    discoverGradientMiddle: "rgba(0,0,0,0.28)",
    discoverGradientBottom: "rgba(0,0,0,0.92)",

    messagesBackground: "#000000",
    profileGradientStart: "#000000",
    profileGradientMiddle: "#000000",
    profileGradientEnd: "#000000",
    profileCard: "#111111",
    profileEdit: "#FFFFFF",
    profileEditForeground: "#111111",
    profileLabel: "#FFFFFF",
    profileMuted: "#B8B8B8",
    profileRule: "#333333",
    profileChip: "#222222",
    profileChipForeground: "#FFFFFF",
    premiumBackground: "#000000",
    premiumCard: "#111111",
    premiumAccent: "#FFFFFF",
    premiumAccentForeground: "#111111",
    premiumForeground: "#FFFFFF",
    premiumMuted: "#B8B8B8",
    premiumBorder: "#333333",
    premiumSoft: "#222222",
    premiumPass: "#FFFFFF",
    premiumHeroFade: "rgba(0,0,0,0.48)",
    premiumHeroBorder: "rgba(255,255,255,0.18)",
    photoBadge: "rgba(0,0,0,0.62)",
    photoBadgeForeground: "#ffffff",
    // Other users' full profile floating actions (screen is always dark)
    publicPassSurface: "rgba(255,255,255,0.92)",
    publicPassIcon: "#111111",
    publicToast: "rgba(23,19,23,0.92)",
    publicHeroFade: "rgba(12,10,12,0.35)",
    // Conversation screen (default light reference, with dark chat theme)
    chatBackground: "#000000",
    chatCard: "#111111",
    chatForeground: "#FFFFFF",
    chatMuted: "#B8B8B8",
    chatBorder: "#333333",
    chatSoft: "#222222",
    chatPink: "#FFFFFF",
    chatOnAccent: "#FFFFFF",
    chatOnline: "#B8B8B8",
    chatBlue: "#D0D0D0",
    chatPurple: "#A0A0A0",
    chatGreen: "#777777",
    chatDarkBackground: "#000000",
    chatDarkCard: "#111111",
    chatDarkForeground: "#FFFFFF",
    chatDarkMuted: "#B8B8B8",
    chatDarkBorder: "#333333",
    chatDarkSoft: "#222222",
    chatLightSwatch: "#F2F2F2",
    chatSearchHighlight: "#FFFFFF",
    chatScrim: "rgba(0,0,0,0.42)",
    chatMediaBackdrop: "#050506",
    chatMediaControl: "rgba(0,0,0,0.45)",
    chatSwatchBorder: "rgba(0,0,0,0.12)",

    destructive: "#f05a6e",
    destructiveForeground: "#ffffff",
    border: "#333333",
    input: "#333333",
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 8,
};

export default colors;
