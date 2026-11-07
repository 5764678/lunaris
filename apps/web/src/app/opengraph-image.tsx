import { ImageResponse } from "next/og";

/**
 * Link-preview card (Open Graph image) shown when the site address is pasted into a chat
 * app, an email or a submission page. Drawn from text and shapes only, so it carries no
 * third-party logo and always matches the product name.
 */
export const alt = "LUNARIS: sunlight, Earth visibility and terrain for candidate Moon landing sites";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const CRATERS = [
  { left: 120, top: 150, d: 120 },
  { left: 300, top: 330, d: 170 },
  { left: 90, top: 380, d: 70 },
  { left: 380, top: 110, d: 60 },
  { left: 240, top: 60, d: 40 },
];

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        color: "#e6eaef",
        background: "linear-gradient(135deg, #05070a 0%, #0b0f14 55%, #10151c 100%)",
      }}
    >
      <div
        style={{
          position: "absolute",
          right: -170,
          top: 55,
          width: 640,
          height: 640,
          borderRadius: 320,
          display: "flex",
          background:
            "radial-gradient(circle at 32% 28%, #d5dbe3 0%, #8d97a6 40%, #4a5563 72%, #1c232d 100%)",
        }}
      >
        {CRATERS.map((c) => (
          <div
            key={`${c.left}-${c.top}`}
            style={{
              position: "absolute",
              left: c.left,
              top: c.top,
              width: c.d,
              height: c.d,
              borderRadius: c.d / 2,
              display: "flex",
              background: "radial-gradient(circle at 60% 60%, rgba(5,7,10,0.35) 0%, rgba(5,7,10,0.12) 70%)",
              border: "2px solid rgba(230,234,239,0.18)",
            }}
          />
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontSize: 26, letterSpacing: 7, color: "#7cb5ff" }}>
          LUNAR MISSION INTELLIGENCE
        </div>
        <div style={{ display: "flex", fontSize: 128, fontWeight: 700, marginTop: 20, letterSpacing: 4 }}>
          LUNARIS
        </div>
        <div style={{ display: "flex", fontSize: 44, lineHeight: 1.25, marginTop: 14, maxWidth: 620 }}>
          Which Moon landing site gets sunlight and a view of Earth?
        </div>
      </div>

      <div style={{ display: "flex", fontSize: 25, color: "#a9b3c1", maxWidth: 640 }}>
        Built on NASA LOLA terrain and SPICE geometry. A preliminary planning tool, not a landing system.
      </div>
    </div>,
    { ...size },
  );
}
