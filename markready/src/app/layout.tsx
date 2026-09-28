import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import { getSiteUrl } from "@/lib/site-url";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz"],
});

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  title: "MarkReady — IELTS Writing Feedback in Seconds",
  description:
    "Get examiner-level band scores and actionable feedback on your IELTS Writing Task 2, Task 1 Academic, and Task 1 General essays in under 15 seconds.",
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: "MarkReady — IELTS Writing Feedback in Seconds",
    description:
      "Get examiner-level band scores and actionable feedback on your IELTS essays in under 15 seconds.",
    siteName: "MarkReady",
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MarkReady — IELTS Writing Feedback in Seconds",
    description:
      "Get examiner-level band scores and actionable feedback on your IELTS essays in under 15 seconds.",
    images: ["/twitter-image"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#FAF8F3] text-[#23282B]">
        {children}
      </body>
    </html>
  );
}
