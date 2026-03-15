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
      <body className="min-h-screen text-slate-900 antialiased">
        <div className="relative mx-auto min-h-screen max-w-6xl overflow-hidden bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(248,250,252,0.92))] pb-20 shadow-[0_32px_120px_rgba(15,23,42,0.14)] backdrop-blur md:my-5 md:min-h-[calc(100vh-2.5rem)] md:rounded-[40px] md:border md:border-white/60">
          {children}
          <BottomNav />
        </div>
      </body>
    </html>
  );
}

