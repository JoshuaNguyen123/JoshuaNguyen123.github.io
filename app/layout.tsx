import type { Metadata } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const newsreader = Newsreader({ variable: "--font-newsreader", subsets: ["latin"] });

const title = "Joshua Nguyen — FDE, AI Developer, Technical Researcher";
const description =
  "Joshua Nguyen is an AI developer and technical researcher who likes turning ideas into useful software and sharing what he learns.";

export const metadata: Metadata = {
  metadataBase: new URL("https://joshuanguyen123.github.io"),
  title,
  description,
  alternates: { canonical: "/" },
  // Search indexing stays on; "noai" / "noimageai" ask compliant crawlers not
  // to use the content or portrait for model training. robots.txt handles the rest.
  robots: { index: true, follow: true, "max-image-preview": "standard" },
  other: { robots: "noai, noimageai" },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title,
    description,
    type: "website",
    url: "/",
    images: [{ url: "/og-personal.jpg", width: 1536, height: 1024, alt: "Joshua Nguyen — AI developer and technical researcher in Bozeman, Montana" }],
  },
  twitter: { card: "summary_large_image", title, description, images: ["/og-personal.jpg"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable}`}>{children}</body>
    </html>
  );
}
