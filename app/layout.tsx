import "./globals.css";

export const metadata = {
  title: "Auto-Invest Pro",
  description: "AI 智能投資儀表板",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW">
      <body className="bg-gray-900 text-white antialiased">{children}</body>
    </html>
  );
}