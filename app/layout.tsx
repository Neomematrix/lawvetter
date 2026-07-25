import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Cormorant_Garamond } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const imageUrl = `${protocol}://${host}/og.png`;

  return {
    title: "CounselCheck | Know who represents you",
    description:
      "Verified attorney profiles, authentic client reviews, and thoughtful legal referrals.",
    openGraph: {
      title: "CounselCheck | Know who represents you",
      description:
        "Verified attorney profiles, authentic client reviews, and thoughtful legal referrals.",
      images: [{ url: imageUrl, width: 1200, height: 630, alt: "CounselCheck attorney reviews and referrals" }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "CounselCheck | Know who represents you",
      description:
        "Verified attorney profiles, authentic client reviews, and thoughtful legal referrals.",
      images: [imageUrl],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${cormorant.variable}`}>
        {children}
      </body>
    </html>
  );
}
