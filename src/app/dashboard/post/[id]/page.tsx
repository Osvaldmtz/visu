"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function PostReviewPage() {
  const { id } = useParams();
  const router = useRouter();
  const [post, setPost] = useState<any>(null);
  const [caption, setCaption] = useState("");
  const [loading, setLoading] = useState("");

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data } = await supabase.from("posts").select("*").eq("id", id).single();
      if (data) {
        setPost(data);
        setCaption(data.caption);
      }
    };
    load();
  }, [id]);

  const updateStatus = async (status: string) => {
    setLoading(status);
    const supabase = createClient();
    await supabase.from("posts").update({ status, caption }).eq("id", id);
    router.push("/dashboard");
    router.refresh();
  };

  const handleRegenerate = async () => {
    setLoading("REGENERATE");
    try {
      await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId: post.brand_id, layout: post.layout, replaceId: post.id }),
      });
      router.push("/dashboard");
      router.refresh();
    } finally {
      setLoading("");
    }
  };

  if (!post) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-neutral-400">Loading...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => router.push("/dashboard")}
          className="text-sm text-neutral-400 hover:text-white mb-6 block"
        >
          &larr; Back to dashboard
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="aspect-square bg-surface-light rounded-xl overflow-hidden border border-surface-border">
            {post.image_url && (
              <img src={post.image_url} alt={post.title} className="w-full h-full object-cover" />
            )}
          </div>

          <div className="flex flex-col">
            <h2 className="text-xl font-bold mb-1">{post.title}</h2>
            <span className="text-xs text-neutral-500 mb-6">
              Layout {post.layout} &middot; {post.status}
            </span>

            <label className="text-sm text-neutral-400 mb-2">Caption</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={8}
              className="bg-surface-light border border-surface-border rounded-lg px-3 py-2.5 text-white text-sm resize-none focus:outline-none focus:border-accent mb-6 flex-1"
            />

            <div className="flex gap-3">
              <button
                onClick={() => updateStatus("APPROVED")}
                disabled={!!loading}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium py-3 rounded-lg transition-colors text-sm"
              >
                {loading === "APPROVED" ? "..." : "Approve"}
              </button>
              <button
                onClick={handleRegenerate}
                disabled={!!loading}
                className="flex-1 bg-surface-light hover:bg-surface-border disabled:opacity-50 text-white font-medium py-3 rounded-lg transition-colors text-sm border border-surface-border"
              >
                {loading === "REGENERATE" ? "..." : "Regenerate"}
              </button>
              <button
                onClick={() => updateStatus("DISCARDED")}
                disabled={!!loading}
                className="flex-1 bg-red-600/20 hover:bg-red-600/30 disabled:opacity-50 text-red-400 font-medium py-3 rounded-lg transition-colors text-sm"
              >
                {loading === "DISCARDED" ? "..." : "Discard"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
