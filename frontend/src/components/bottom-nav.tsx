"use client";

import { Bot, ClipboardPenLine, House, Sparkles, Target } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "首页", icon: House },
  { href: "/meals", label: "记餐", icon: ClipboardPenLine },
  { href: "/review", label: "计划", icon: Target },
  { href: "/chat", label: "Agent", icon: Bot },
];

export default function BottomNav() {
  const pathname = usePathname();

  if (pathname.startsWith("/onboarding")) {
    return null;
  }

  return (
    <nav className="fixed bottom-3 left-1/2 z-50 w-[calc(100%-1.25rem)] max-w-[406px] -translate-x-1/2 md:bottom-7">
      <div className="glass-card flex items-center gap-1 rounded-[28px] px-2 py-2">
        {navItems.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-[20px] px-2 py-2 text-[11px] transition ${
                active
                  ? "bg-[#1e1c2b] text-white shadow-[0_16px_24px_rgba(30,28,43,0.18)]"
                  : "text-slate-500 hover:bg-white/70 hover:text-slate-900"
              }`}
            >
              {active ? (
                <div className="rounded-full bg-white/12 p-1.5">
                  <Icon className="h-4 w-4" />
                </div>
              ) : (
                <Icon className="h-4 w-4" />
              )}
              <span>{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          className="hidden h-11 w-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,#7b6cff,#9b7bff)] text-white shadow-[0_16px_24px_rgba(111,99,255,0.28)] sm:flex"
          aria-label="快捷入口"
        >
          <Sparkles className="h-5 w-5" />
        </button>
      </div>
    </nav>
  );
}
