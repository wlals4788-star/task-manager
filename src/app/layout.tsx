import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "경영지원본부 업무관리",
  description: "업무리스트 관리 시스템",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
