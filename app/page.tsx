"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/lib/AuthContext";
import LoadingSpinner from "@/app/components/LoadingSpinner";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      router.replace(user ? "/dashboard" : "/login");
    }
  }, [user, loading, router]);

  return (
    <div className="h-screen flex items-center justify-center bg-white">
      <LoadingSpinner size="lg" message="Loading..." />
    </div>
  );
}
