"use client";

/**
 * Last resort: this replaces the root layout, so it cannot rely on the app's
 * fonts, theme variables or components. Everything here is inline on purpose.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem 1rem",
          background: "#f8fafc",
          color: "#0f172a",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "32rem" }}>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700 }}>
            The application failed to start
          </h1>
          <p style={{ marginTop: "0.75rem", lineHeight: 1.6, color: "#475569" }}>
            Something went wrong before the page could be rendered. Please reload; if it keeps
            happening, report it to the hostel office with the reference below.
          </p>
          {error.digest && (
            <p
              style={{
                marginTop: "1rem",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: "0.75rem",
                color: "#64748b",
              }}
            >
              Reference: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              padding: "0.6rem 1.25rem",
              borderRadius: "0.6rem",
              border: "none",
              background: "#1d4ed8",
              color: "#ffffff",
              fontSize: "0.9rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
