"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Home, 
  FilePlus, 
  ClipboardList, 
  Settings, 
  Library, 
  Menu, 
  X, 
  LogOut, 
  Calculator 
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useAuth } from "@/context/AuthContext";
import AdminGuard from "@/components/auth/AdminGuard";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const navItems = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "New Quote", href: "/quote/new", icon: FilePlus },
  { name: "Quotations", href: "/quotes", icon: ClipboardList },
  { name: "Masters", href: "/masters", icon: Settings },
  { name: "Library", href: "/references", icon: Library },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  const isPublicView = pathname?.startsWith('/quote/view/');
  const isLoginPage = pathname?.startsWith('/login');
  const isAdminSetup = pathname?.startsWith('/admin-setup');
  const closeSidebar = () => setIsOpen(false);

  // If it's a public view page, login, or admin-setup, hide the sidebar and navigation
  if (isPublicView || isLoginPage || isAdminSetup) {
    return (
      <div className="min-h-screen bg-white">
        {children}
      </div>
    );
  }

  return (
    <AdminGuard>
      <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
        {/* Mobile Top Header */}
        <div className="md:hidden flex items-center justify-between p-4 bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-[#2d221c] rounded-xl flex items-center justify-center shadow-lg shadow-amber-900/20">
               <Calculator className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <span className="text-xl font-black text-[#2d221c] tracking-tighter uppercase leading-none block">Woodflex</span>
              <span className="text-[10px] font-bold text-amber-700 uppercase tracking-widest leading-none">Costing Engine</span>
            </div>
          </div>
          <button onClick={() => setIsOpen(true)} className="p-2 text-gray-500 hover:text-amber-600 transition-colors">
            <Menu className="w-6 h-6" />
          </button>
        </div>

        {/* Sidebar Overlay (Mobile) */}
        {isOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-50 md:hidden" 
            onClick={closeSidebar}
          />
        )}

        {/* Sidebar Panel */}
        <aside className={cn(
          "fixed inset-y-0 left-0 w-64 bg-brown-900 text-white z-50 transform transition-transform duration-300 md:relative md:translate-x-0 bg-[#2d221c]",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-3 font-bold text-2xl">
              <Calculator className="w-8 h-8 text-amber-400" />
              <span>Woodflex</span>
            </div>
            <button onClick={closeSidebar} className="md:hidden">
              <X className="w-6 h-6" />
            </button>
          </div>

          <nav className="mt-6 px-4 space-y-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeSidebar}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                    isActive 
                      ? "bg-amber-600 text-white" 
                      : "text-amber-100/70 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.name}</span>
                </Link>
              );
            })}
          </nav>

          <div className="absolute bottom-8 left-0 w-full px-6">
            <button 
              onClick={() => signOut()}
              className="flex items-center gap-3 text-amber-200/50 hover:text-white transition-colors w-full px-4 py-2 border border-white/10 rounded-lg"
            >
              <LogOut className="w-5 h-5" />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        {/* Mobile bottom navigation bar */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#2d221c] border-t border-white/5 z-50 px-2 pb-safe">
          <div className="flex justify-around items-center h-16 max-w-lg mx-auto overflow-x-auto no-scrollbar">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center justify-center min-w-[64px] transition-all",
                    isActive ? "text-amber-500" : "text-amber-100/50 hover:text-amber-200"
                  )}
                >
                  <Icon className={cn("w-5 h-5 mb-1", isActive ? "animate-pulse" : "")} />
                  <span className="text-[10px] uppercase font-bold tracking-tighter">{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
          <header className="hidden md:flex items-center justify-between px-8 py-4 bg-white border-b sticky top-0 z-40">
            <h1 className="text-xl font-semibold text-gray-800 capitalize">
              {navItems.find(item => item.href === pathname)?.name || "Dashboard"}
            </h1>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user ? (user.email?.split('@')[0] || 'Admin') : 'Not Signed In'}</p>
                <p className="text-xs text-gray-500">{user ? user.email : 'Guest Access'}</p>
              </div>
            </div>
          </header>

          <section className="p-4 md:p-8 pb-20 md:pb-8 flex-grow">
            <div className="max-w-5xl mx-auto h-full">
              {children}
            </div>
          </section>
        </main>
      </div>
    </AdminGuard>
  );
}
