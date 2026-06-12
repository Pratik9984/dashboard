import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/app/lib/AuthContext";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "Stack & Scale — Admin Panel",
  description: "Agency management dashboard for Stack & Scale web development agency",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full">
        <AuthProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: { background: "#fff", color: "#0F172A", border: "1px solid #E2E8F0", borderRadius: "12px", fontSize: "14px", padding: "12px 16px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
