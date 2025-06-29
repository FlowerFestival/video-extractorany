import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#7c3aed",
};

export const metadata: Metadata = {
  title: "ExtractorAny - Video Audio Extractor | Extract Audio from Video Files Online",
  description: "Extract audio from video files online with ExtractorAny. Free video extractorany tool to convert MP4, AVI, MOV to MP3. No registration required, secure and fast audio extraction.",
  keywords: "video extractorany, extract audio from video, video to audio converter, MP4 to MP3, online audio extractor, video audio separator, extractorany, audio extraction tool, video converter",
  authors: [{ name: "ExtractorAny" }],
  creator: "ExtractorAny",
  publisher: "ExtractorAny",
  robots: "index, follow",
  openGraph: {
    title: "ExtractorAny - Video Audio Extractor",
    description: "Extract audio from video files online with ExtractorAny. Free video extractorany tool to convert video to audio.",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "ExtractorAny - Video Audio Extractor",
    description: "Extract audio from video files online with ExtractorAny. Free video extractorany tool.",
  },

};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="canonical" href="https://video-extractorany.netlify.app" />
        <meta name="format-detection" content="telephone=no" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              "name": "ExtractorAny",
              "description": "Online video audio extractor tool to extract audio from video files",
              "url": "https://video-extractorany.netlify.app",
              "applicationCategory": "MultimediaApplication",
              "operatingSystem": "Any",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD"
              }
            }),
          }}
        />
      </head>
      <body className={`${geist.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
