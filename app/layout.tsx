import type { Metadata } from "next";
import type { ReactNode } from "react";
import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pikimin Postcard Atlas",
  description: "Map and catalog Pikmin Bloom postcards with photos, notes, and automatic place tags."
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
