import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";

import { Navbar } from "@/components/Navbar";
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
};

export const viewport: Viewport = {
  themeColor: "#FF5A5F",
  width: "device-width",
  initialScale: 1,
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
      </body>
    </html>
  );
}
