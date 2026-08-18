import { APP_URL, REPO_URL, SITE_NAME } from "@/lib/site";
import { LogoMark } from "./Icons";

export function Footer() {
  return (
    <footer className="border-t border-border-subtle bg-elev px-6 py-14">
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-10 grid gap-10 md:grid-cols-[2fr_1fr_1fr_1fr]">
          <div className="max-w-xs">
            <div className="flex items-center gap-2.5 text-[15px] font-extrabold">
              <span className="grid h-7 w-7 place-items-center rounded-[7px] bg-gradient-to-br from-orange to-orange-bright text-white">
                <LogoMark className="h-4 w-4" />
              </span>
              Agent<em className="text-orange not-italic">Swarm</em>.in
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-text-dim">
              The control plane for AI workforces. One goal. A governed swarm. Verified work.
            </p>
          </div>
          <FooterCol
            title="Platform"
            links={[
              ["#platform", "Platform"],
              ["#truth", "What's live"],
              ["#use-cases", "Use cases"],
            ]}
          />
          <FooterCol title="Resources" links={[["#faq", "FAQ"], [REPO_URL, "GitHub"]]} />
          <FooterCol title="Build" links={[[APP_URL, "Open Command Centre"], ["/llms.txt", "llms.txt"]]} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-6 text-xs text-text-muted">
          <span>© {new Date().getFullYear()} {SITE_NAME}</span>
          <span>Claims policy: unavailable stays UNAVAILABLE — no fabricated metrics.</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: readonly (readonly [string, string])[] }) {
  return (
    <div>
      <h5 className="mb-3.5 text-[11px] font-bold uppercase tracking-wider text-text-muted">{title}</h5>
      <ul className="flex flex-col gap-2.5">
        {links.map(([href, label]) => (
          <li key={href}>
            <a
              href={href}
              target={href.startsWith("http") ? "_blank" : undefined}
              rel={href.startsWith("http") ? "noopener" : undefined}
              className="text-[13px] text-text-dim transition hover:text-text"
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
