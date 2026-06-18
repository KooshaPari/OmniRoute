import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Unified Review",
  description: "Unified AI Code Review Dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, -apple-system, sans-serif", margin: 0, padding: 0, background: "#0d1117", color: "#c9d1d9" }}>
        {children}
      </body>
    </html>
  );
}
