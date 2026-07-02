import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Reputation Boost | Enhance Your Online Presence",
  description:
    "Discover where your business stands, get an AI-driven action plan, and learn how to outrank competitors and improve your visibility.",
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "Reputation Boost | Enhance Your Online Presence",
    description:
      "AI-powered local rankings, competitor tracking, and actionable insights to boost your Google Maps visibility.",
    url: "https://reputationboost.com",
    siteName: "Reputation Boost",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${jakarta.variable} h-full scroll-smooth`}>
      <body className="min-h-full flex flex-col antialiased">{children}</body>
    </html>
  );
}
