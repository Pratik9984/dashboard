import React from "react";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  message?: string;
}

export default function LoadingSpinner({ size = "md", message }: LoadingSpinnerProps) {
  const sizeMap = { sm: "w-5 h-5", md: "w-8 h-8", lg: "w-12 h-12" };
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 animate-fade-in">
      <div className={`${sizeMap[size]} border-2 border-slate-200 border-t-primary-600 rounded-full animate-spin`} />
      {message && <p className="text-sm text-slate-400">{message}</p>}
    </div>
  );
}
