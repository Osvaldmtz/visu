"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CleanupButton({ brandId, count }: { brandId: string; count: number }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  if (count === 0) return null;

  const handleCleanup = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cleanup-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId }),
      });
      if (!res.ok) throw new Error("Cleanup failed");
      router.refresh();
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  };

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-neutral-400">
          Eliminar {count} post{count > 1 ? "s" : ""}?
        </span>
        <button
          onClick={handleCleanup}
          disabled={loading}
          className="text-xs bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors"
        >
          {loading ? "..." : "Confirmar"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs text-neutral-500 hover:text-white px-2 py-1.5"
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-xs text-neutral-500 hover:text-red-400 transition-colors"
    >
      Limpiar descartados ({count})
    </button>
  );
}
