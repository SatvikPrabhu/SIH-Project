import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AERO3D - GIS Recon Engine",
  description: "Single-Pass Drone Video to 3D Model Generation System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-slate-950">{children}</body>
    </html>
  );
}
