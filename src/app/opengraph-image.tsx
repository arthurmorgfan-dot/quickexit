import { ImageResponse } from "next/og";

export const alt =
  "QuickExit. Trade it. Profit. Send it home. Crypto trading product concept.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "66px 76px",
        background: "#0b0e0d",
        color: "#f1f4f2",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <svg width="42" height="42" viewBox="0 0 40 40">
          <rect width="40" height="40" rx="10" fill="#96edb9" />
          <path
            d="M12 28 28 12M13 12h15v15"
            stroke="#102719"
            strokeWidth="3"
            fill="none"
          />
        </svg>
        <span style={{ fontSize: 36, letterSpacing: -1 }}>QuickExit.</span>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          fontSize: 82,
          letterSpacing: -4,
          lineHeight: 1.12,
        }}
      >
        <span>Trade it. Profit.</span>
        <span style={{ color: "#96edb9" }}>Send it home.</span>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: 26,
          borderTop: "1px solid #2b3530",
          color: "#a0afa5",
          fontSize: 21,
        }}
      >
        <span>Crypto trading. A clearer way out.</span>
        <span style={{ color: "#96edb9", fontSize: 16, letterSpacing: 2 }}>
          PRODUCT CONCEPT
        </span>
      </div>
    </div>,
    size,
  );
}
