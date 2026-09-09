import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SupportPilot — AI Support & Knowledge Assistant",
  description: "A practical AI workspace for customer support teams.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
