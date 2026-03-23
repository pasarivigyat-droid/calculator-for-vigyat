"use client";

import React from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  footer?: React.ReactNode;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, title, subtitle, footer, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden",
          className
        )}
        {...props}
      >
        {title && (
          <div className="px-6 py-4 border-b border-gray-50 bg-[#fafafa]">
            <h3 className="text-lg font-semibold text-[#2d221c]">{title}</h3>
            {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
          </div>
        )}
        <div className="p-4 md:p-6">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-gray-50 bg-[#fafafa]/50">{footer}</div>}
      </div>
    );
  }
);
Card.displayName = "Card";

export { Card };
