import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Reputation Boost | Rank Higher on Google Maps",
  description:
    "Optimize your Google Business Profile to rank in the Local 3-Pack. Increase visibility, calls, direction requests, and website traffic from Google Maps.",
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "Reputation Boost | Rank Higher on Google Maps",
    description:
      "We help you rank higher on Google Maps — more visibility, calls, and direction requests from your Google Business Profile.",
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
