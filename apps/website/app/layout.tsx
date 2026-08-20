import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { APP_URL, DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — AI Workforce Control Plane`,
    template: `%s — ${SITE_NAME}`,
  },
  description: DESCRIPTION,
  keywords: [
    "AI agent orchestration",
    "AI workforce",
    "multi-agent systems",
    "agent swarm",
    "mission control plane",
    "AI agent approvals",
    "governed AI agents",
  ],
  authors: [{ name: "AgentSwarm.in" }],
  robots: { index: true, follow: true },
  alternates: { canonical: SITE_URL },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — AI Workforce Control Plane`,
    description: DESCRIPTION,
    url: SITE_URL,
    locale: "en_IN",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "AgentSwarm.in — governed AI workforce control plane" }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — AI Workforce Control Plane`,
    description: DESCRIPTION,
    images: ["/opengraph-image"],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      description: DESCRIPTION,
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${APP_URL}/#software`,
      name: "AgentSwarm Command Centre",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Web",
      url: APP_URL,
      description:
        "Mission control application for AgentSwarm: create missions, watch a governed swarm of specialist agents execute them, approve consequential actions, and inspect the event ledger.",
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}/#faq`,
      mainEntity: [
        { "@type": "Question", name: "What is AgentSwarm?", acceptedAnswer: { "@type": "Answer", text: "AgentSwarm is an open-source control plane for planning, dispatching, governing, and auditing work performed by specialist AI agents." } },
        { "@type": "Question", name: "Does AgentSwarm support human approval?", acceptedAnswer: { "@type": "Answer", text: "Yes. Tasks can pause at approval gates before consequential actions continue, with decisions recorded in the mission event ledger." } },
      ],
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </head>
      <body>
        <a
          href="#main"
          className="fixed left-4 top-[-100%] z-[1000] rounded bg-orange px-4 py-3 font-semibold text-white focus:top-4"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
