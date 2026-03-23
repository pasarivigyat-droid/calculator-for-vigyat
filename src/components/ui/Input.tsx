"use client";

import React from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, ...props }, ref) => {
    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label className="text-xs font-bold text-[#2d221c]/70 uppercase tracking-widest block ml-1">
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <input
          ref={ref}
          className={cn(
            "w-full px-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all placeholder:text-gray-300 text-gray-900 font-medium text-sm h-12",
            error ? "border-red-500 focus:ring-red-500/10" : "hover:border-gray-300",
            className
          )}
          {...props}
        />
        {error && <p className="text-xs font-medium text-red-500 mt-1">{error}</p>}
        {helperText && !error && <p className="text-xs text-gray-500 mt-1">{helperText}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
