import Link from "next/link";
import { APP_URL, REPO_URL } from "@/lib/site";
import { LogoMark } from "./Icons";

const LINKS = [
  ["#platform", "Platform"],
  ["#truth", "What's live"],
  ["#use-cases", "Use cases"],
  ["#faq", "FAQ"],
] as const;

export function Nav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-border-subtle bg-bg/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-6 px-6 py-3.5">
        <Link href="/" className="flex items-center gap-2.5 text-[15px] font-extrabold tracking-tight">
          <span className="grid h-7 w-7 place-items-center rounded-[7px] bg-gradient-to-br from-orange to-orange-bright text-white">
            <LogoMark className="h-4 w-4" />
          </span>
          Agent<em className="text-orange not-italic">Swarm</em>.in
        </Link>
        <div className="hidden items-center gap-6 text-sm text-text-dim md:flex">
          {LINKS.map(([href, label]) => (
            <a key={href} href={href} className="transition hover:text-text">
              {label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener"
            className="hidden rounded-md border border-border px-4 py-2 text-sm font-semibold text-text-dim transition hover:border-border-strong hover:text-text sm:block"
          >
            Source
          </a>
          <a
            href={APP_URL}
            className="rounded-md bg-orange px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#d14a18]"
          >
            Open Command Centre
          </a>
        </div>
      </div>
    </nav>
  );
}
