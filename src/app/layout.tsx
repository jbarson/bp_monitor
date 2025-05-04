import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import NavBar from "@/components/NavBar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BP Monitor",
  description: "Track and monitor your blood pressure readings",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 dark:bg-gray-900`}
      >
        <div className="min-h-screen flex flex-col">
          <NavBar />
          <main className="flex-grow px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </main>
          <footer className="py-4 text-center text-sm text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-800">
            <p>BP Monitor &copy; {new Date().getFullYear()} - Your blood pressure data never leaves your device</p>
          </footer>
        </div>
      </body>
    </html>
  );
}
