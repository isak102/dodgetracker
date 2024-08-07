import { GoogleAnalytics, GoogleTagManager } from "@next/third-parties/google";
import { Analytics } from "@vercel/analytics/react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "react-hot-toast";
import { ReactQueryClientProvider } from "../components/higherOrder/queryClientProvider";
import NavBar from "../features/navigation/components/NavBar";
import { supportedUserRegions } from "../regions";
import "./globals.css";
import { CSPostHogProvider } from "./providers";

const inter = Inter({ subsets: ["latin"] });

const availableRegions = [...supportedUserRegions]
  .map((r) => r.toUpperCase())
  .join(", ");

export const metadata: Metadata = {
  metadataBase: new URL("https://www.dodgetracker.com"),
  title: {
    default: "Dodgetracker - League of Legends",
    template: "%s - Dodgetracker - League of Legends",
  },
  description: `Track League of Legends (LOL) dodges in Master, Grandmaster, and Challenger. Available for ${availableRegions}.`,
  twitter: {
    card: "summary_large_image",
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
      className="overflow-y-scroll scrollbar scrollbar-track-zinc-800 scrollbar-thumb-zinc-900"
    >
      <head>
        <script
          data-domain="www.dodgetracker.com"
          src="https://statspro.io/js/broadcaster.js"
          async
        />
      </head>
      <body
        className={`${inter.className} dark !min-w-full bg-zinc-700 text-zinc-300`}
      >
        <CSPostHogProvider>
          <ReactQueryClientProvider>
            <NavBar />
            <main>{children}</main>
            <GoogleAnalytics gaId={process.env.GA_ID ?? ""} />
            <GoogleTagManager gtmId={process.env.GTM_ID ?? ""} />
            <Analytics />
            <Toaster position="bottom-right" />
          </ReactQueryClientProvider>
        </CSPostHogProvider>
      </body>
    </html>
  );
}
