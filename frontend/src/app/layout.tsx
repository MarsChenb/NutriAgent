import type { Metadata } from "next";
import "./globals.css";
import BottomNav from "@/components/bottom-nav";

export const metadata: Metadata = {
  title: "NutriAgent - AI健康教练",
  description: "面向减脂与健康管理场景的移动端优先 AI 健康教练 Web 应用。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="text-slate-900 antialiased">
        <div className="app-shell">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.86),transparent_70%)]" />
          {children}
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
