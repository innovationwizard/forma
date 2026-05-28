/**
 * OG image generation for FORMA — Santa Elena.
 *
 * Static 1200×630 image rendered once at build time + cached.
 * Visible whenever the production URL is shared on Slack, WhatsApp,
 * LinkedIn, etc. Composition follows the brand manual's preferred
 * treatment: white isotipo + wordmark on the navy primary (#0c2530).
 *
 * Per the brand manual "Uso del ícono como elemento de diseño" (page 5)
 * the icon geometries may be used as design elements; here the third
 * underscore shape extends across the bottom edge as a subtle anchor.
 */

import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "FORMA — Santa Elena · Seguimiento presupuestal";
export const size = { width: 1200, height: 630 } as const;
export const contentType = "image/png";

const NAVY = "#0c2530";
const WHITE = "#ffffff";
const TEAL_LIGHT = "#6da3af";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: NAVY,
          color: WHITE,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px 96px",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Top row: isotipo + wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <svg width="120" height="50" viewBox="0 0 240 100">
            <g fill={WHITE}>
              <rect x="20" y="20" width="44" height="8" />
              <rect x="20" y="20" width="8" height="60" />
              <rect x="90" y="44" width="30" height="8" />
              <rect x="90" y="44" width="8" height="36" />
              <rect x="146" y="72" width="22" height="8" />
            </g>
          </svg>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              lineHeight: 1,
            }}
          >
            <div style={{ fontSize: 56, letterSpacing: 8, fontWeight: 500 }}>
              FORMA
            </div>
            <div
              style={{
                marginTop: 10,
                fontSize: 16,
                letterSpacing: 6,
                opacity: 0.7,
              }}
            >
              CAPITAL INMOBILIARIO
            </div>
          </div>
        </div>

        {/* Center: project name */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div
            style={{
              fontSize: 96,
              fontWeight: 500,
              letterSpacing: -2,
              lineHeight: 1.05,
            }}
          >
            Condominio Santa Elena
          </div>
          <div
            style={{
              fontSize: 28,
              color: TEAL_LIGHT,
              letterSpacing: 0.4,
            }}
          >
            Seguimiento presupuestal · Antigua Guatemala
          </div>
        </div>

        {/* Bottom row: large icon-as-design-element underscore (per brand manual page 5) */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div
            style={{
              height: 6,
              width: 360,
              background: TEAL_LIGHT,
              opacity: 0.5,
            }}
          />
          <div style={{ display: "flex", fontSize: 18, color: TEAL_LIGHT, letterSpacing: 4 }}>
            forma-santa-elena.vercel.app
          </div>
        </div>
      </div>
    ),
    size,
  );
}
