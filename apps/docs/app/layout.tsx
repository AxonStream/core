import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: {
    default: "AxonPuls Platform Documentation",
    template: "%s | AxonPuls Platform"
  },
  description: "Enterprise-grade real-time platform with WebSocket infrastructure, multi-tenant architecture, and production-ready APIs. Complete documentation for developers and enterprises.",
  keywords: [
    "AxonPuls", "WebSocket", "Real-time", "Multi-tenant", "API", "Documentation",
    "Enterprise", "Platform", "NestJS", "Redis", "PostgreSQL", "TypeScript",
    "AI", "Agents", "Tools", "Workflows", "RAG", "Knowledge Base"
  ],
  authors: [{ name: "AxonPuls Platform Team" }],
  creator: "AxonPuls Platform",
  publisher: "AxonPuls Platform",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://docs.AxonPuls.dev",
    title: "AxonPuls Platform Documentation",
    description: "Enterprise-grade real-time platform with WebSocket infrastructure, multi-tenant architecture, and production-ready APIs.",
    siteName: "AxonPuls Platform Documentation",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "AxonPuls Platform Documentation",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AxonPuls Platform Documentation",
    description: "Enterprise-grade real-time platform documentation",
    images: ["/og-image.png"],
  },
  metadataBase: new URL('https://docs.AxonPuls.dev'),
  verification: {
    google: "your-google-verification-code",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-950 text-gray-100`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
