import type { Metadata } from "next";
import "./globals.css";
import { AuthSessionProvider } from "@/components/session-provider";

export const metadata: Metadata = {
  title: "YouTube API Test Tool",
  description: "YouTube Data API behavior investigation tool"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>
        <AuthSessionProvider>{children}</AuthSessionProvider>
      </body>
    </html>
  );
}
