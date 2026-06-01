import { ImageResponse } from "next/og";

// Branded social share image (1200×630), the intelligent instrument: near-black
// field, bracket corners, white wordmark, the single green tagline accent.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Stryvia — the intelligence you build with";

const corner = (s: React.CSSProperties): React.CSSProperties => ({
  position: "absolute",
  width: 56,
  height: 56,
  ...s,
});

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: "#0A0B0A",
          position: "relative",
          padding: 96,
        }}
      >
        {/* bracket corners */}
        <div style={corner({ top: 56, left: 56, borderTop: "2px solid rgba(244,246,244,0.25)", borderLeft: "2px solid rgba(244,246,244,0.25)" })} />
        <div style={corner({ top: 56, right: 56, borderTop: "2px solid rgba(244,246,244,0.25)", borderRight: "2px solid rgba(244,246,244,0.25)" })} />
        <div style={corner({ bottom: 56, left: 56, borderBottom: "2px solid rgba(244,246,244,0.25)", borderLeft: "2px solid rgba(244,246,244,0.25)" })} />
        <div style={corner({ bottom: 56, right: 56, borderBottom: "2px solid rgba(244,246,244,0.25)", borderRight: "2px solid rgba(244,246,244,0.25)" })} />

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 14, height: 14, borderRadius: 999, background: "#C0FA20" }} />
          <div
            style={{
              fontSize: 22,
              letterSpacing: 8,
              color: "rgba(244,246,244,0.5)",
              fontFamily: "sans-serif",
            }}
          >
            STRYVIA / THE INTELLIGENCE YOU BUILD WITH
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            marginTop: 36,
            fontSize: 76,
            fontWeight: 600,
            lineHeight: 1.05,
            fontFamily: "sans-serif",
            maxWidth: 920,
          }}
        >
          <span style={{ color: "#F4F6F4" }}>
            The thing you could never build without a team.&nbsp;
          </span>
          <span style={{ color: "#C0FA20" }}>Build it now.</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
