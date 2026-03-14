import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Visu — AI Social Content with Human Approval",
  description: "Generate social media content grids with AI. Review, approve, and publish.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
