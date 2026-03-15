import type { Metadata } from "next";
import "./globals.css";
import BottomNav from "@/components/bottom-nav";

export const metadata: Metadata = {
  title: "NutriAgent - AI 健康教练",
  description: "单用户 AI 健康教练 Web 应用，支持建档、餐食识别、运动记录、热量缺口分析与周度复盘。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-[radial-gradient(circle_at_top,_#eef4ff,_#f7f8fc_45%,_#eef2f7)] text-slate-900 antialiased">
        <div className="relative mx-auto min-h-screen max-w-5xl overflow-hidden bg-white/78 pb-16 shadow-[0_24px_90px_rgba(15,23,42,0.12)] backdrop-blur md:my-6 md:min-h-[calc(100vh-3rem)] md:rounded-[36px]">
          {children}
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
