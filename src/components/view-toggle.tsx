"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function ViewToggle() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = searchParams.get("view") ?? "grid";

  const setView = (v: string) => {
    router.push(`/dashboard?view=${v}`);
  };

  return (
    <div className="flex bg-surface-light border border-surface-border rounded-lg p-0.5">
      <button
        onClick={() => setView("grid")}
        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
          view === "grid"
            ? "bg-accent/20 text-accent"
            : "text-neutral-400 hover:text-white"
        }`}
      >
        Grid
      </button>
      <button
        onClick={() => setView("calendar")}
        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
          view === "calendar"
            ? "bg-accent/20 text-accent"
            : "text-neutral-400 hover:text-white"
        }`}
      >
        Calendario
      </button>
    </div>
  );
}
