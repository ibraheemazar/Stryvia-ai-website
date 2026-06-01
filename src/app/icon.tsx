import { ImageResponse } from "next/og";

// Favicon, generated at build (Spec §9: circular black badge with the green S).
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: 7,
        }}
      >
        <div
          style={{
            fontSize: 22,
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
