import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./world.css";
export const metadata: Metadata = {
  title: "Moon Pattern — See how the world feels today.",
  description:
    "See how the world feels today. Explore cities, share a small moment, and discover what moves you.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon-192.png" },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Moon Pattern",
  },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f5f4ec",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
