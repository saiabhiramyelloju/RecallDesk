import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "RecallDesk · Support with memory", description: "An AI customer-support agent that remembers every customer." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
