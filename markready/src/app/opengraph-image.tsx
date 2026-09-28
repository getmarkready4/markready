import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";
export const alt = "MarkReady — IELTS Writing Feedback in Seconds";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 60,
          background: "#FAF8F3",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: '"Fraunces", serif',
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 20,
            textAlign: "center",
            paddingLeft: 60,
            paddingRight: 60,
          }}
        >
          <div
            style={{
              fontSize: 80,
              fontWeight: "bold",
              color: "#1F5C4E",
            }}
          >
            MarkReady
          </div>
          <div
            style={{
              fontSize: 48,
              color: "#23282B",
            }}
          >
            IELTS Writing Feedback in Seconds
          </div>
          <div
            style={{
              fontSize: 32,
              color: "#5B6266",
              marginTop: 40,
            }}
          >
            Band scores and actionable feedback in under 15 seconds
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
