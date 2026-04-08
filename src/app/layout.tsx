import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pulsr — All your stats. One bold dashboard.",
  description:
    "Creator analytics and scheduling tool. Connect all your socials, track your growth, and schedule posts from one bold dashboard.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
