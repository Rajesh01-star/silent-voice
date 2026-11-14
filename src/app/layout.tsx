import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Silent Voice — AI Gesture & Speech Translator",
  description:
    "Accessible AI web application translating subtle hand gestures, eye blinks, and facial cues into spoken English, Hindi, and Odia.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col font-sans bg-slate-950 text-slate-100 antialiased selection:bg-teal-500 selection:text-slate-950">
        {children}
      </body>
    </html>
  );
}
