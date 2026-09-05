import type { Tenant } from "@/generated/prisma/client";

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function isValidHex(value: string | null | undefined): value is string {
  return !!value && HEX_RE.test(value);
}

/** Picks black/white foreground text for a given hex background (WCAG-ish relative luminance). */
function contrastForeground(hex: string): string {
  const normalized =
    hex.length === 4
      ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
      : hex;
  const r = parseInt(normalized.slice(1, 3), 16) / 255;
  const g = parseInt(normalized.slice(3, 5), 16) / 255;
  const b = parseInt(normalized.slice(5, 7), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return luminance > 0.45 ? "#10151A" : "#F5F3EE";
}

/**
 * Builds the CSS custom-property override block for a tenant's brand colors.
 * Injected as a <style> tag at the root layout so shadcn's theme tokens
 * (which already read `var(--primary)` etc via @theme inline in
 * globals.css) pick up tenant branding with zero per-component changes.
 * Falls back to the built-in default theme when a tenant hasn't set colors
 * or a stored value fails hex validation (defends the style tag against
 * corrupted/malicious values reaching raw CSS).
 */
export function buildTenantThemeCss(tenant: Pick<Tenant, "primaryColor" | "secondaryColor" | "accentColor" | "fontFamily"> | null): string {
  if (!tenant) return "";

  const vars: string[] = [];

  if (isValidHex(tenant.primaryColor)) {
    vars.push(`--primary: ${tenant.primaryColor};`);
    vars.push(`--primary-foreground: ${contrastForeground(tenant.primaryColor)};`);
    vars.push(`--sidebar-primary: ${tenant.primaryColor};`);
    vars.push(`--sidebar-primary-foreground: ${contrastForeground(tenant.primaryColor)};`);
    vars.push(`--ring: ${tenant.primaryColor};`);
  }
  if (isValidHex(tenant.secondaryColor)) {
    vars.push(`--secondary: ${tenant.secondaryColor};`);
    vars.push(`--secondary-foreground: ${contrastForeground(tenant.secondaryColor)};`);
  }
  if (isValidHex(tenant.accentColor)) {
    // Deliberately NOT --accent itself — that token drives subtle hover/
    // highlight washes (menu items, selected states) and needs to stay a
    // soft neutral regardless of a tenant's brand color. accentColor instead
    // feeds the secondary chart series and one-off highlight badges.
    vars.push(`--chart-2: ${tenant.accentColor};`);
  }
  if (tenant.fontFamily) {
    // Stored as a full CSS font-family stack, e.g. "'Poppins', sans-serif".
    const safeFont = tenant.fontFamily.replace(/[<>{}]/g, "");
    vars.push(`--font-sans: ${safeFont};`);
  }

  if (vars.length === 0) return "";

  return `:root { ${vars.join(" ")} }`;
}
