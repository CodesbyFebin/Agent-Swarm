import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" })
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })

export const metadata: Metadata = { title: "AgentSwarm — AI Workforce Control Plane", description: "Plan missions, coordinate specialist agents, approve actions, and verify outcomes." }
export const viewport: Viewport = { themeColor: "#ff5a1f", colorScheme: "dark", userScalable: false }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className="bg-background"><body className={`${geist.variable} ${mono.variable}`}>{children}</body></html>
}
