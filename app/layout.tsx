import type { Metadata } from "next";
import { Lato, Plus_Jakarta_Sans, Cormorant_Garamond } from "next/font/google";
import "./globals.css";
import "./editorial-dark.css";
import {ShortlistProvider} from "./Shortlist";
import LegalFooter from "./LegalFooter";
import GoogleAnalytics from "./GoogleAnalytics";
import {SITE_DESCRIPTION,SITE_NAME,SITE_ORIGIN,safeJsonLd} from './seo';

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

const googleVerification=(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION||'').trim();
export const metadata:Metadata={
    metadataBase:new URL(SITE_ORIGIN),
    title:{default:"Find and Compare Georgia Lawyers | LawVetter",template:"%s | LawVetter"},
    description:SITE_DESCRIPTION,
    applicationName:SITE_NAME,
    category:"legal directory",
    creator:SITE_NAME,
    publisher:SITE_NAME,
    robots:{index:true,follow:true,googleBot:{index:true,follow:true,'max-image-preview':'large','max-snippet':-1,'max-video-preview':-1}},
    ...(googleVerification?{verification:{google:googleVerification}}:{}),
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
      siteName:SITE_NAME,
      title: "Find and Compare Georgia Lawyers | LawVetter",
      description:SITE_DESCRIPTION,
      url:SITE_ORIGIN,
      images: [{ url: "/og.png", width: 1200, height: 630, alt: "LawVetter Georgia lawyer directory" }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Find and Compare Georgia Lawyers | LawVetter",
      description:SITE_DESCRIPTION,
      images: ["/og.png"],
    },
  };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head><script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeJsonLd({'@context':'https://schema.org','@graph':[{'@type':'Organization','@id':SITE_ORIGIN+'/#organization',name:SITE_NAME,url:SITE_ORIGIN,logo:SITE_ORIGIN+'/brand/lawvetter-icon.svg',description:SITE_DESCRIPTION},{'@type':'WebSite','@id':SITE_ORIGIN+'/#website',url:SITE_ORIGIN,name:SITE_NAME,description:SITE_DESCRIPTION,publisher:{'@id':SITE_ORIGIN+'/#organization'},inLanguage:'en-US'}]})}}/><GoogleAnalytics/></head>
      <body className={`${lato.variable} ${jakarta.variable} ${editorial.variable}`}>
        <ShortlistProvider>{children}<LegalFooter/></ShortlistProvider>
      </body>
    </html>
  );
}
