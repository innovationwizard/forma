/**
 * Isotipo de FORMA — Capital Inmobiliario.
 *
 * Three geometric shapes (large Γ + medium Γ + underscore) sharing a
 * common baseline. Per the brand manual (page 3 "Racional del logo"):
 *   "La composición del isotipo representa tanto la F de Forma como la
 *    silueta de edificios de pequeño a grande o del suelo hacia arriba."
 *
 * Color is inherited via `fill="currentColor"` so callers control it with
 * a Tailwind text-* utility. Default callers use `text-foreground` (brand
 * navy `#0c2530`); the dark-background variant uses `text-background`
 * (white) per the brand manual's "Logos en blanco" page.
 *
 * Recreated from the brand manual reference (Manual de Marca_Forma.pdf,
 * pages 4–5). Geometry: two filled rectangles per Γ, one for the underscore.
 */

import { cn } from "@/lib/utils";

interface FormaIsotipoProps {
  className?: string;
  /// Accessible label. Omit when the isotipo is rendered alongside a visible
  /// "FORMA" wordmark (mark it `aria-hidden` instead via the parent).
  title?: string;
}

export function FormaIsotipo({ className, title }: FormaIsotipoProps) {
  const labelled = title != null;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 240 100"
      fill="currentColor"
      role={labelled ? "img" : undefined}
      aria-label={labelled ? title : undefined}
      aria-hidden={labelled ? undefined : true}
      className={cn("inline-block", className)}
    >
      {labelled ? <title>{title}</title> : null}

      {/* Shape 1 — large Γ (the F-spine / tallest building) */}
      <rect x="20" y="20" width="44" height="8" />
      <rect x="20" y="20" width="8" height="60" />

      {/* Shape 2 — medium Γ */}
      <rect x="90" y="44" width="30" height="8" />
      <rect x="90" y="44" width="8" height="36" />

      {/* Shape 3 — underscore (the smallest building) */}
      <rect x="146" y="72" width="22" height="8" />
    </svg>
  );
}
