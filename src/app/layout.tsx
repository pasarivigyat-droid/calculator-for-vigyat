import type { Metadata } from "next";
import "./globals.css";
import Shell from "@/components/layout/Shell";
import { AuthProvider } from "@/context/AuthContext";

export const metadata: Metadata = {
  title: "Woodflex | Furniture Costing & Quoting",
  description: "Internal furniture costing and quotation tool",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-slate-900 antialiased">
        <AuthProvider>
          <Shell>{children}</Shell>
        </AuthProvider>
      </body>
    </html>
  );
}
