import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VASP Attribution Engine",
  description: "Automated attribution of suspect crypto wallets to the nearest legally-addressable VASP.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
