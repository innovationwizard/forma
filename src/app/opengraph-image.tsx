/**
 * OG image generation for the FORMA · Santa Elena app.
 *
 * Static 1200×630 image rendered + cached at the `/opengraph-image` route.
 * Visible whenever the production URL is shared on WhatsApp, Slack, etc.
 * Composition follows the brand manual: white isotipo + wordmark on the
 * navy primary (#0c2530).
 *
 * Per _THE_RULES.MD Rule 1 and [[project_naming_truth]]: every string
 * rendered in this image is either verbatim from the SSOT (brand manual
 * for "FORMA"/"Capital Inmobiliario", parsed xlsx for "Santa Elena") or
 * approved by Jorge. No subtitles, taglines, or descriptive copy is
 * authored on his behalf.
 */

import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Santa Elena — FORMA Capital Inmobiliario";
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

        {/* Center: project name only — verbatim from [[project_naming_truth]] */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 128,
              fontWeight: 500,
              letterSpacing: -3,
              lineHeight: 1.0,
            }}
          >
            Santa Elena
          </div>
        </div>

        {/* Bottom row: thin brand bar — no fabricated tagline */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              height: 6,
              width: 360,
              background: TEAL_LIGHT,
              opacity: 0.5,
            }}
          />
        </div>
      </div>
    ),
    size,
  );
}
