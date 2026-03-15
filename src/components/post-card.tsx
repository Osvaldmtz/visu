"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-yellow-500/20 text-yellow-400",
  APPROVED: "bg-green-500/20 text-green-400",
  SCHEDULED: "bg-blue-500/20 text-blue-400",
  PUBLISHED: "bg-accent/20 text-accent",
  DISCARDED: "bg-red-500/20 text-red-400",
};

const LAYOUT_NAMES = ["Overlay", "Split", "Minimal", "Foto"];

export function PostCard({ post }: { post: any }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm) { setConfirm(true); return; }
    setDeleting(true);
    const supabase = createClient();
    if (post.image_url?.includes("/storage/v1/object/public/posts/")) {
      const path = post.image_url.split("/storage/v1/object/public/posts/")[1];
      if (path) await supabase.storage.from("posts").remove([decodeURIComponent(path)]);
    }
    if (post.title) {
      await supabase.from("post_topics").delete().eq("brand_id", post.brand_id).eq("topic", post.title);
    }
    await supabase.from("posts").delete().eq("id", post.id);
    router.refresh();
  };

  return (
    <div className="bg-surface-light border border-surface-border rounded-xl overflow-hidden hover:border-accent/50 transition-colors group relative">
      {post.image_url ? (
        <div className="aspect-square bg-neutral-800 relative overflow-hidden">
          <img
            src={post.image_url}
            alt={post.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          {/* Delete button on hover */}
          {post.status !== "PUBLISHED" && (
            <button
              onClick={handleDelete}
              className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                confirm
                  ? "bg-red-600 text-white opacity-100"
                  : "bg-black/50 text-white/70 hover:text-white opacity-0 group-hover:opacity-100"
              }`}
            >
              {deleting ? (
                <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              ) : confirm ? "?" : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              )}
            </button>
          )}
        </div>
      ) : (
        <div className="aspect-square bg-neutral-800 flex items-center justify-center">
          <span className="text-neutral-500 text-sm">No image</span>
        </div>
      )}
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-neutral-500">{LAYOUT_NAMES[post.layout]}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[post.status] ?? ""}`}>
            {post.status}
          </span>
        </div>
        {post.status === "SCHEDULED" && post.scheduled_at && (
          <p className="text-xs text-blue-400 mb-1">
            {new Date(post.scheduled_at).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}
          </p>
        )}
        <p className="text-sm text-neutral-300 line-clamp-2">{post.caption}</p>
      </div>
    </div>
  );
}
