import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { GenerateButton } from "@/components/generate-button";
import { PostCard } from "@/components/post-card";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: brand } = await supabase
    .from("brands")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!brand) redirect("/onboarding");

  const { data: posts } = await supabase
    .from("posts")
    .select("*")
    .eq("brand_id", brand.id)
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen">
      <header className="border-b border-surface-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold text-accent">Visu</span>
          <span className="text-neutral-500">/</span>
          <span className="text-sm text-neutral-300">{brand.name}</span>
        </div>
        <form action="/api/auth/signout" method="post">
          <button className="text-sm text-neutral-400 hover:text-white transition-colors">
            Sign out
          </button>
        </form>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Content Grid</h1>
            <p className="text-sm text-neutral-400 mt-1">
              {posts?.length ?? 0} posts generated
            </p>
          </div>
          <GenerateButton brandId={brand.id} />
        </div>

        {!posts?.length ? (
          <div className="text-center py-20 border border-dashed border-surface-border rounded-xl">
            <p className="text-neutral-400 mb-4">No posts yet</p>
            <p className="text-sm text-neutral-500">
              Click "Generate grid" to create your first content batch
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {posts.map((post) => (
              <Link key={post.id} href={`/dashboard/post/${post.id}`}>
                <PostCard post={post} />
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
