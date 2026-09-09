import type { Metadata } from "next";
import "./globals.css";
import SessionButton from "./components/SessionButton";

export const metadata: Metadata = {
  title: "WorkPilot AI — AI Workforce Control Plane",
  description: "A cloud AI workforce workspace for goals, agents, tasks, knowledge, execution and human approval.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}<SessionButton /></body>
    </html>
  );
}
