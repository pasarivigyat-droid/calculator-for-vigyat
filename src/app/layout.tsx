import type { Metadata } from "next";
import "./globals.css";
import Shell from "@/components/layout/Shell";
import { AuthProvider } from "@/context/AuthContext";
import { PwaRegister } from "@/components/PwaRegister";

export const metadata: Metadata = {
  title: "Woodflex | Furniture Costing & Quoting",
  description: "Internal furniture costing and quotation tool",
  manifest: "/manifest.json",
  themeColor: "#1c1917",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Woodflex",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Outfit:wght@100..900&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen bg-white text-slate-900 antialiased">
        <PwaRegister />
        <AuthProvider>
          <Shell>{children}</Shell>
        </AuthProvider>
      </body>
    </html>
  );
}
