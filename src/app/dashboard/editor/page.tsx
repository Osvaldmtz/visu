"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import TemplateEditor from "@/components/template-editor";

export default function EditorPage() {
  const router = useRouter();
  const [brand, setBrand] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data } = await supabase
        .from("brands")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (!data) { router.push("/onboarding"); return; }
      setBrand(data);
    };
    load();
  }, [router]);

  if (!brand) {
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

        <h1 className="text-2xl font-bold mb-6">Template Editor</h1>

        <TemplateEditor
          brand={brand}
          onSaved={() => {
            router.push("/dashboard");
            router.refresh();
          }}
        />
      </div>
    </div>
  );
}
