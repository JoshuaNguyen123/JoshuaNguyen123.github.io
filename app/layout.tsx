import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import { ogImage, siteDescription, siteName, siteTitle, siteUrl } from "@/content/site";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const newsreader = Newsreader({ variable: "--font-newsreader", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: siteTitle, template: `%s — ${siteName}` },
  description: siteDescription,
  authors: [{ name: siteName, url: siteUrl }],
  creator: siteName,
  alternates: { canonical: "/" },
  // Search indexing stays on; "noai" / "noimageai" ask compliant crawlers not
  // to use the content or portrait for model training. robots.txt handles the rest.
  robots: { index: true, follow: true, "max-image-preview": "standard" },
  other: { robots: "noai, noimageai" },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    siteName,
    locale: "en_US",
    type: "website",
    url: "/",
    images: [ogImage],
  },
  // Card type only: title, description, and image then follow each page's Open Graph values.
  twitter: { card: "summary_large_image" },
};

// The site is deliberately one light "warm paper" scheme. Declaring it keeps
// form controls and scrollbars light for viewers whose OS is in dark mode.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light",
  themeColor: "#f5f3ed",
};

// The contact form posts directly to Web3Forms until the verifying worker is
// configured, so the provider origin is admitted only while that fallback is
// live. Configuring the worker tightens the policy on the next build.
const contactUsesWorker = Boolean(process.env.NEXT_PUBLIC_CONTACT_API_URL && process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY);
const web3formsOrigin = contactUsesWorker ? "" : " https://api.web3forms.com";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        {/* GitHub Pages serves no headers, so policy ships in the markup. Next's
            static export emits inline bootstrap scripts and has no nonce, so
            script-src must permit unsafe-inline: this is defence in depth, NOT
            the control that stops injected markup. Sanitizing post HTML in
            lib/blog.ts is. What this still buys: no third-party script origins,
            no base-tag hijacking, no plugins, and form posts and XHR confined to
            known hosts, which blocks the usual exfiltration paths. */}
        <meta
          httpEquiv="Content-Security-Policy"
          content={[
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' https://js.hcaptcha.com https://hcaptcha.com https://*.hcaptcha.com",
            "style-src 'self' 'unsafe-inline' https://hcaptcha.com https://*.hcaptcha.com",
            "img-src 'self' data: https://hcaptcha.com https://*.hcaptcha.com",
            "font-src 'self'",
            `connect-src 'self' https://raw.githubusercontent.com https://joshua-portfolio-blog-admin.personal-ai-digest.workers.dev https://hcaptcha.com https://*.hcaptcha.com${web3formsOrigin}`,
            "frame-src https://hcaptcha.com https://*.hcaptcha.com",
            "worker-src 'self' blob:",
            `form-action 'self'${web3formsOrigin}`,
            "base-uri 'self'",
            "object-src 'none'",
            "upgrade-insecure-requests",
          ].join("; ")}
        />
        <meta name="referrer" content="strict-origin-when-cross-origin" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable}`}>
        <a className="skip-link" href="#main">Skip to content</a>
        {children}
      </body>
    </html>
  );
}