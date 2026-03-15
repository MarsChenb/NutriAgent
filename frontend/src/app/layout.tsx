import type { Metadata } from "next";
import "./globals.css";
import BottomNav from "@/components/bottom-nav";

export const metadata: Metadata = {
  title: "NutriAgent - AI 健康教练",
  description: "AI 饮食记录、热量分析与个性化健康教练",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-[radial-gradient(circle_at_top,_#eef4ff,_#f7f8fc_45%,_#eef2f7)] text-slate-900 antialiased">
        <div className="relative mx-auto min-h-screen max-w-md overflow-hidden bg-white/78 pb-16 shadow-[0_24px_90px_rgba(15,23,42,0.12)] backdrop-blur">
          {children}
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
