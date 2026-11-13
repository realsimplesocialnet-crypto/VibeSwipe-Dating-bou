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
