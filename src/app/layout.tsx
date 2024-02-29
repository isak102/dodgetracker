import { GoogleAnalytics } from "@next/third-parties/google";
import { Analytics } from "@vercel/analytics/react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import NavBar from "../components/NavBar";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    metadataBase: new URL("https://www.dodgetracker.com"),
    title: {
        default: "Dodgetracker - League of Legends",
        template: "%s - Dodgetracker - League of Legends",
    },
    description: "Track League of Legends dodges in master+",
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
        <html lang="en">
            <body className={`${inter.className} bg-zinc-700 text-zinc-300`}>
                <NavBar />
                {children}
                <GoogleAnalytics gaId="G-MDBY12TWLN" />
                <Analytics />
            </body>
        </html>
    );
}
