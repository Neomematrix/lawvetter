import type { Metadata } from "next";
import { headers } from "next/headers";
import { Lato, Plus_Jakarta_Sans, Cormorant_Garamond } from "next/font/google";
import "./globals.css";
import "./editorial-dark.css";
import {ShortlistProvider} from "./Shortlist";

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
    title: "CounselCheck | Know who represents you",
    description:
      "Explore Georgia attorneys and firms, follow search rankings, and save a shortlist to compare professional records.",
    icons: {
      icon: "/counselcheck-favicon-gold.png",
      shortcut: "/counselcheck-favicon-gold.png",
      apple: "/counselcheck-favicon-gold.png",
    },
    openGraph: {
      title: "CounselCheck | Know who represents you",
      description:
        "Explore Georgia attorneys and firms, follow search rankings, and save a shortlist to compare professional records.",
      images: [{ url: imageUrl, width: 1200, height: 630, alt: "CounselCheck attorney reviews and referrals" }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "CounselCheck | Know who represents you",
      description:
        "Explore Georgia attorneys and firms, follow search rankings, and save a shortlist to compare professional records.",
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
        <ShortlistProvider>{children}</ShortlistProvider>
      </body>
    </html>
  );
}
