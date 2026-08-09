import { ImageResponse } from "next/og";
import { DEMO_APP_URL } from "@/features/shared/app-origins";

export const alt = "NightLifeNext — nightclub operations, reimagined — interactive demo tour";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Brand tokens mirrored from globals.css so the card matches the app.
const INK = "#f5efe6";
const MUTED = "#c9b8a2";
const GOLD = "#e8a33d";
const DEEP_GOLD = "#8a5a1c";
const BG_TOP = "#191410";
const BG_BOTTOM = "#2e1f12";

const host = new URL(DEMO_APP_URL).hostname;

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 76px",
          background: `linear-gradient(155deg, ${BG_TOP} 0%, ${BG_TOP} 35%, ${BG_BOTTOM} 100%)`,
          color: INK,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Ambient gold wash — echoes the club-lights backdrop of the app. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(640px 340px at 82% 18%, ${GOLD}2e, transparent 70%), radial-gradient(480px 300px at 10% 88%, ${DEEP_GOLD}33, transparent 70%)`,
          }}
        />

        {/* Wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 22, position: "relative" }}>
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: 14,
              background: `linear-gradient(135deg, ${GOLD}, ${DEEP_GOLD})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#1a1410",
              fontSize: 32,
              fontWeight: 800,
            }}
          >
            N
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: 4,
            }}
          >
            <span>NIGHTLIFE</span>
            <span style={{ color: GOLD }}>NEXT</span>
          </div>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 26, position: "relative" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 76,
              fontWeight: 800,
              lineHeight: 1.04,
              letterSpacing: -1,
            }}
          >
            <span>Nightclub operations,</span>
            <span>
              reimagined<span style={{ color: GOLD }}>.</span>
            </span>
          </div>
          <div style={{ fontSize: 30, color: MUTED, lineHeight: 1.35, maxWidth: 760 }}>
            QR ordering · table service · live floor ops — explore the
            interactive demo, doors to close.
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", gap: 18, position: "relative" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: `${GOLD}1f`,
              border: `1px solid ${GOLD}55`,
              borderRadius: 999,
              padding: "10px 22px",
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: 2,
              color: GOLD,
            }}
          >
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: 999,
                background: GOLD,
              }}
            />
            <span>LIVE DEMO</span>
          </div>
          {!host.startsWith("localhost") && (
            <div style={{ fontSize: 24, color: MUTED, letterSpacing: 1 }}>{host}</div>
          )}
        </div>
      </div>
    ),
    { ...size },
  );
}
