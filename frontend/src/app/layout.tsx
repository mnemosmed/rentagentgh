import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";

import { Navbar } from "@/components/Navbar";
import { PwaInstallButton } from "@/components/PwaInstallButton";
import { ServiceWorkerRegister } from "@/components/PwaRegister";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "RentAgentGhana — Find Rental Agents in Accra",
  description:
    "Find trusted rental agents in Accra by neighborhood — East Legon, Cantonments, Osu and more.",
  applicationName: "RentAgentGhana",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "RentAgent",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#FF5A5F",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${jakarta.variable} font-sans`}>
        <Navbar />
        <main>{children}</main>
        <footer className="mt-0 border-t border-[#d8e0ea] bg-white py-8 text-center text-sm text-navy/55">
          <div className="container-app">
            Copyright {new Date().getFullYear()} RentAgentGhana
          </div>
        </footer>
        <PwaInstallButton />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
