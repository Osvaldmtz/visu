"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import TemplateEditor from "@/components/template-editor";

export default function PostReviewPage() {
  const { id } = useParams();
  const router = useRouter();
  const [post, setPost] = useState<any>(null);
  const [brand, setBrand] = useState<any>(null);
  const [loading, setLoading] = useState("");

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: postData } = await supabase
        .from("posts")
        .select("*")
        .eq("id", id)
        .single();
      if (postData) {
        setPost(postData);
        const { data: brandData } = await supabase
          .from("brands")
          .select("*")
          .eq("id", postData.brand_id)
          .single();
        setBrand(brandData);
      }
    };
    load();
  }, [id]);

  const updateStatus = async (status: string) => {
    setLoading(status);
    const supabase = createClient();
    await supabase.from("posts").update({ status }).eq("id", id);
    router.push("/dashboard");
    router.refresh();
  };

  if (!post || !brand) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-neutral-400">Loading...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-5xl mx-auto">
        <button
          onClick={() => router.push("/dashboard")}
          className="text-sm text-neutral-400 hover:text-white mb-6 block"
        >
          &larr; Back to dashboard
        </button>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold">{post.title}</h2>
            <span className="text-xs text-neutral-500">
              Layout {post.layout} &middot; {post.status}
            </span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => updateStatus("APPROVED")}
              disabled={!!loading}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg transition-colors text-sm"
            >
              {loading === "APPROVED" ? "..." : "Approve"}
            </button>
            <button
              onClick={() => updateStatus("DISCARDED")}
              disabled={!!loading}
              className="bg-red-600/20 hover:bg-red-600/30 disabled:opacity-50 text-red-400 font-medium px-4 py-2 rounded-lg transition-colors text-sm"
            >
              {loading === "DISCARDED" ? "..." : "Discard"}
            </button>
          </div>
        </div>

        <TemplateEditor
          brand={brand}
          initialLayout={post.layout}
          initialTitle={post.title}
          initialCaption={post.caption}
          postId={post.id}
          onSaved={() => {
            router.push("/dashboard");
            router.refresh();
          }}
        />
      </div>
    </div>
  );
}
