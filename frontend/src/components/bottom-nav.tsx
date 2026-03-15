"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  {
    href: "/",
    label: "首页",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    ),
  },
  {
    href: "/meals",
    label: "记录",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />,
  },
  {
    href: "/review",
    label: "复盘",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-6m4 6V7m4 10v-3M5 21h14" />,
  },
  {
    href: "/chat",
    label: "AI 私教",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />,
  },
];

export default function BottomNav() {
  const pathname = usePathname();

  if (pathname.startsWith("/onboarding")) {
    return null;
  }

  return (
    <nav className="fixed bottom-3 left-1/2 z-50 w-[calc(100%-1.25rem)] max-w-xl -translate-x-1/2 rounded-[28px] border border-white/70 bg-white/88 px-2 py-2 shadow-[0_18px_36px_rgba(15,23,42,0.14)] backdrop-blur md:bottom-6">
      <div className="flex items-center justify-between gap-1">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-w-[64px] flex-1 items-center justify-center gap-2 rounded-[20px] px-2 py-2 text-xs transition ${
                active ? "bg-slate-950 text-white shadow-[0_10px_24px_rgba(15,23,42,0.22)]" : "text-slate-500 hover:bg-slate-100/90 hover:text-slate-900"
              }`}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {item.icon}
              </svg>
              <span className="hidden sm:inline">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

