import type { Metadata } from "next";
import localFont from "next/font/local";
import { Overpass } from "next/font/google";
import "./globals.css";

const overpass = Overpass({
  subsets: ["latin"],
  weight: ["300", "700"],
  variable: "--font-overpass",
  display: "swap",
});

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Great British 48",
  description: "Explore England's 48 ceremonial counties",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} ${overpass.variable}`}>
        {children}
      </body>
    </html>
  );
}
