/**
 * FORMA wordmark + isotipo composite.
 *
 * Mirrors the four "Variaciones del logo" from the brand manual (page 4):
 *   - vertical-full      = isotipo stacked above FORMA + CAPITAL INMOBILIARIO
 *   - horizontal-full    = isotipo · FORMA · CAPITAL INMOBILIARIO inline
 *   - vertical-simple    = isotipo stacked above FORMA (no tagline)
 *   - horizontal-simple  = isotipo · FORMA inline (no tagline)
 *
 * Per the brand manual "Uso correcto e incorrecto":
 *   - The word "FORMA" never stands alone — always with the isotipo. The
 *     `variant` API enforces this; there is no "wordmark only" variant.
 *   - On dark backgrounds, use `text-background` (white) via Tailwind on
 *     the parent. The component itself uses `currentColor`.
 *   - The tagline "CAPITAL INMOBILIARIO" can be separated typographically
 *     but must remain legible — we keep it on the same component.
 */

import { cn } from "@/lib/utils";

import { FormaIsotipo } from "./FormaIsotipo";

type Variant = "vertical-full" | "horizontal-full" | "vertical-simple" | "horizontal-simple";

interface FormaLogoProps {
  variant?: Variant;
  className?: string;
  /// Accessible name. Defaults to "FORMA — Capital Inmobiliario" (or just
  /// "FORMA" for the simple variants).
  title?: string;
}

export function FormaLogo({
  variant = "vertical-simple",
  className,
  title,
}: FormaLogoProps) {
  const isVertical = variant === "vertical-full" || variant === "vertical-simple";
  const includeTagline = variant === "vertical-full" || variant === "horizontal-full";
  // Accessible name per Manual de Marca_Forma.pdf — no separator between FORMA
  // and CAPITAL INMOBILIARIO (the manual stacks them or spaces them visually;
  // there is no punctuation joining the two strings in any approved variant).
  const label = title ?? (includeTagline ? "FORMA Capital Inmobiliario" : "FORMA");

  return (
    <div
      role="img"
      aria-label={label}
      className={cn(
        "inline-flex",
        isVertical ? "flex-col items-center gap-2" : "flex-row items-center gap-3",
        className,
      )}
    >
      <FormaIsotipo
        className={cn(isVertical ? "h-12 w-auto" : "h-7 w-auto")}
      />

      <div
        className={cn(
          "flex flex-col leading-none",
          isVertical ? "items-center" : "items-start",
        )}
      >
        <span
          className="font-heading text-[1.4em] font-medium tracking-[0.18em]"
          style={{ fontFamily: "var(--font-heading), var(--font-sans), system-ui, sans-serif" }}
        >
          FORMA
        </span>
        {includeTagline ? (
          <span
            className="mt-1 text-[0.55em] tracking-[0.22em] opacity-80"
            style={{ fontFamily: "var(--font-sans), system-ui, sans-serif" }}
          >
            CAPITAL INMOBILIARIO
          </span>
        ) : null}
      </div>
    </div>
  );
}
