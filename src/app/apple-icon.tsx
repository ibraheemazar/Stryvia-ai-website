import { ImageResponse } from "next/og";

// Apple touch icon (Spec §9: filled black badge, green S, holds at small sizes).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0A0B0A",
        }}
      >
        <div
          style={{
            fontSize: 120,
            fontWeight: 700,
            color: "#C0FA20",
            fontFamily: "sans-serif",
          }}
        >
          S
        </div>
      </div>
    ),
    { ...size },
  );
}
