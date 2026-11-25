import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mela.io — Festive Virtual Carnival",
  description:
    "A cozy, browser-based 3D Indian festive carnival for private groups of up to five players.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
