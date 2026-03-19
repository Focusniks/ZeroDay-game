import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ZdSessionProvider from "./session-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Zero Day: Exploit Network",
  description:
    "Многопользовательская онлайн-игра-симуляция про взлом сетей, веба и социальную инженерию в безопасной виртуальной среде.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={`${inter.className} antialiased`}>
        <ZdSessionProvider>{children}</ZdSessionProvider>
      </body>
    </html>
  );
}
