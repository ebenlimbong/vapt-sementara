"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function Topbar({ userName }: { userName: string }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-surface px-4">
      <div className="text-sm text-muted">Lingkungan: <span className="font-data text-foreground">staging/lab</span></div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-foreground">{userName}</span>
        <Button variant="outline" size="sm" onClick={logout}>
          Keluar
        </Button>
      </div>
    </header>
  );
}
