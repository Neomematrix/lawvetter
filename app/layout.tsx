import type { Metadata } from "next";
import { headers } from "next/headers";
import { Lato, Plus_Jakarta_Sans, Cormorant_Garamond } from "next/font/google";
import "./globals.css";
import "./editorial-dark.css";
import {ShortlistProvider} from "./Shortlist";
import LegalFooter from "./LegalFooter";

const editorial = Cormorant_Garamond({variable:"--font-editorial",subsets:["latin"],weight:["600","700"],style:["normal","italic"],display:"swap"});

const lato = Lato({
  variable: "--font-lato",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  style: ["normal", "italic"],
});
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const imageUrl = `${protocol}://${host}/og.png`;

  return {
    title: "LawVetter | Real reviews from real clients",
    description:
      "Read verified client reviews, explore Georgia attorney records, and compare lawyers with confidence.",
    icons: {
      icon: [
        { url: "/favicon.svg", type: "image/svg+xml" },
        { url: "/favicon.ico", sizes: "any" },
      ],
      shortcut: "/favicon.ico",
      apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
    manifest: "/site.webmanifest",
    openGraph: {
      title: "LawVetter | Real reviews from real clients",
      description:
        "Read verified client reviews, explore Georgia attorney records, and compare lawyers with confidence.",
      images: [{ url: imageUrl, width: 1200, height: 630, alt: "LawVetter attorney reviews and referrals" }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "LawVetter | Real reviews from real clients",
      description:
        "Read verified client reviews, explore Georgia attorney records, and compare lawyers with confidence.",
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
      <body className={`${lato.variable} ${jakarta.variable} ${editorial.variable}`}>
        <ShortlistProvider>{children}<LegalFooter/></ShortlistProvider>
      </body>
    </html>
  );
}
