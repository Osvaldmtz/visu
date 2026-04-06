import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { PostCard } from "@/components/post-card";
import AutoGenerate from "@/components/auto-generate";
import CleanupButton from "@/components/cleanup-button";
import ViewToggle from "@/components/view-toggle";
import CalendarView from "@/components/calendar-view";
import BulkSchedule from "@/components/bulk-schedule";
import BrandSelector from "@/components/brand-selector";
import { getAccessibleBrands, isCollaborator } from "@/lib/brands";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { view?: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const brands = await getAccessibleBrands(supabase);
  const cookieStore = await cookies();
  const activeBrandId = cookieStore.get("visu-active-brand")?.value;
  const brand = brands.find((b) => b.id === activeBrandId) ?? brands[0] ?? null;

  if (!brand) {
    const collab = await isCollaborator(supabase);
    if (collab) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-neutral-400">No tienes marcas asignadas. Contacta al administrador.</p>
        </div>
      );
    }
    redirect("/onboarding");
  }

  const userIsAdmin = brands.some((b) => b.user_id === user.id);

  const { data: posts } = await supabase
    .from("posts")
    .select("*")
    .eq("brand_id", brand.id)
    .order("created_at", { ascending: false });

  const cleanupCount = (posts ?? []).filter(
    (p) => p.status === "DISCARDED" || !p.image_url
  ).length;

  const view = searchParams?.view ?? "grid";

  return (
    <div className="min-h-screen">
      <header className="border-b border-surface-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold text-accent">Visu</span>
          <span className="text-neutral-500">/</span>
          {brands.length > 1 ? (
            <BrandSelector brands={brands} activeBrandId={brand.id} />
          ) : (
            <span className="text-sm text-neutral-300">{brand.name}</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          {userIsAdmin && (
            <Link
              href="/dashboard/team"
              className="text-neutral-400 hover:text-white transition-colors"
              title="Equipo"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </Link>
          )}
          {userIsAdmin && (
            <Link
              href="/dashboard/settings"
              className="text-neutral-400 hover:text-white transition-colors"
              title="Settings"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Link>
          )}
          <form action="/api/auth/signout" method="post">
            <button className="text-sm text-neutral-400 hover:text-white transition-colors">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Content Grid</h1>
            <div className="flex items-center gap-4 mt-1">
              <p className="text-sm text-neutral-400">
                {posts?.length ?? 0} posts generated
              </p>
              <CleanupButton brandId={brand.id} count={cleanupCount} />
              <BulkSchedule posts={posts ?? []} brand={brand} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ViewToggle />
            <Link
              href="/dashboard/editor"
              className="hidden sm:block bg-surface-light hover:bg-surface-border text-neutral-300 font-medium px-4 py-2.5 rounded-lg transition-colors text-sm border border-surface-border"
            >
              Crear manualmente
            </Link>
            <AutoGenerate brand={brand} mode="single" />
            <AutoGenerate brand={brand} mode="batch" />
          </div>
        </div>

        {view === "calendar" ? (
          <CalendarView
            posts={posts ?? []}
            preferredDays={brand.preferred_days ?? [1]}
          />
        ) : (() => {
          const gridPosts = (posts ?? []).filter(
            (p) => p.status !== "PUBLISHED" && p.status !== "DISCARDED"
          );
          return !gridPosts.length ? (
            <div className="text-center py-20 border border-dashed border-surface-border rounded-xl">
              <p className="text-neutral-400 mb-4">No posts yet</p>
              <p className="text-sm text-neutral-500">
                Click &quot;Generar parrilla&quot; to auto-generate your first post
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {gridPosts.map((post) => (
                <Link key={post.id} href={`/dashboard/post/${post.id}`}>
                  <PostCard post={post} />
                </Link>
              ))}
            </div>
          );
        })()}
      </main>
    </div>
  );
}
