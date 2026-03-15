"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Post {
  id: string;
  title: string;
  brand_id: string;
  image_url: string | null;
  status: string;
  scheduled_at: string | null;
  created_at: string;
}

const STATUS_DOT: Record<string, string> = {
  SCHEDULED: "bg-blue-400",
  APPROVED: "bg-green-400",
  PUBLISHED: "bg-[#7C3DE3]",
  DRAFT: "bg-yellow-400",
  DISCARDED: "bg-red-400",
};

const STATUS_BG: Record<string, string> = {
  SCHEDULED: "bg-blue-500/5",
  APPROVED: "bg-green-500/5",
  PUBLISHED: "bg-accent/5",
};

const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const DAYS_ES = ["L", "M", "M", "J", "V", "S", "D"];
const ISO_DAY_LABELS: Record<number, string> = { 1: "Lun", 2: "Mar", 3: "Mie", 4: "Jue", 5: "Vie", 6: "Sab", 7: "Dom" };

function getPostDate(post: Post): string | null {
  const d = post.scheduled_at || post.created_at;
  if (!d) return null;
  try { return new Date(d).toISOString().split("T")[0]; } catch { return null; }
}

function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDayOfMonth(y: number, m: number) { const d = new Date(y, m, 1).getDay(); return d === 0 ? 6 : d - 1; }

function MonthGrid({
  year, month, postsByDate, preferredDays, todayStr, onPostAction,
}: {
  year: number; month: number;
  postsByDate: Record<string, Post[]>;
  preferredDays: number[];
  todayStr: string;
  onPostAction: (post: Post, e: React.MouseEvent) => void;
}) {
  const days = getDaysInMonth(year, month);
  const first = getFirstDayOfMonth(year, month);

  const cells: { day: number | null; dateStr: string }[] = [];
  for (let i = 0; i < first; i++) cells.push({ day: null, dateStr: "" });
  for (let d = 1; d <= days; d++) {
    cells.push({ day: d, dateStr: `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-center mb-2">{MONTHS_ES[month]} {year}</h3>
      <div className="grid grid-cols-7 gap-px mb-px">
        {DAYS_ES.map((d, i) => (
          <div key={i} className="text-[10px] text-neutral-500 text-center py-1 font-medium">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-surface-border rounded-lg overflow-hidden">
        {cells.map((cell, i) => {
          if (cell.day === null) return <div key={i} className="bg-surface min-h-[90px]" />;

          const dayPosts = postsByDate[cell.dateStr] ?? [];
          const isToday = cell.dateStr === todayStr;
          const date = new Date(year, month, cell.day);
          const isoDay = date.getDay() === 0 ? 7 : date.getDay();
          const preferred = preferredDays.includes(isoDay);

          let bgClass = "bg-surface";
          if (dayPosts.length > 0) bgClass = STATUS_BG[dayPosts[0].status] ?? "bg-surface";

          return (
            <div key={i} className={`${bgClass} min-h-[90px] p-1.5 transition-colors`}>
              <div className="flex items-center justify-between mb-0.5">
                <span className={`text-[10px] font-medium ${isToday ? "bg-accent text-white w-5 h-5 rounded-full flex items-center justify-center" : "text-neutral-400"}`}>
                  {cell.day}
                </span>
                {preferred && dayPosts.length === 0 && <span className="w-1 h-1 rounded-full bg-accent/30" />}
              </div>
              <div className="space-y-0.5">
                {dayPosts.map((post) => (
                  <button
                    key={post.id}
                    onClick={(e) => { e.stopPropagation(); onPostAction(post, e); }}
                    className="flex items-center gap-1 p-0.5 rounded hover:bg-white/10 transition-colors w-full text-left"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[post.status] ?? "bg-neutral-500"}`} />
                    <span className="text-[9px] text-neutral-300 truncate">{post.title}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CalendarView({ posts, preferredDays }: { posts: Post[]; preferredDays: number[] }) {
  const router = useRouter();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [popup, setPopup] = useState<{ post: Post; x: number; y: number } | null>(null);
  const [actionLoading, setActionLoading] = useState("");

  const postsByDate = useMemo(() => {
    const map: Record<string, Post[]> = {};
    for (const post of posts) {
      // Only show posts with scheduled_at that are SCHEDULED or PUBLISHED
      if (!post.scheduled_at) continue;
      if (post.status !== "SCHEDULED" && post.status !== "PUBLISHED") continue;
      try {
        const date = new Date(post.scheduled_at).toISOString().split("T")[0];
        if (!map[date]) map[date] = [];
        map[date].push(post);
      } catch { /* skip invalid */ }
    }
    return map;
  }, [posts]);

  const todayStr = today.toISOString().split("T")[0];

  // Next month
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;

  const goNext = () => { if (month === 11) { setYear(year + 1); setMonth(0); } else setMonth(month + 1); };
  const goPrev = () => { if (month === 0) { setYear(year - 1); setMonth(11); } else setMonth(month - 1); };

  const totalScheduled = posts.filter((p) => p.scheduled_at && p.status === "SCHEDULED").length;

  const handlePostAction = (post: Post, e: React.MouseEvent) => {
    setPopup({ post, x: e.clientX, y: e.clientY });
  };

  const handleUnschedule = async () => {
    if (!popup) return;
    setActionLoading("unschedule");
    const supabase = createClient();
    await supabase.from("posts").update({ status: "APPROVED", scheduled_at: null }).eq("id", popup.post.id);
    setPopup(null);
    setActionLoading("");
    router.refresh();
  };

  const handleDelete = async () => {
    if (!popup) return;
    setActionLoading("delete");
    const supabase = createClient();
    const post = popup.post;
    if (post.image_url?.includes("/storage/v1/object/public/posts/")) {
      const path = post.image_url.split("/storage/v1/object/public/posts/")[1];
      if (path) await supabase.storage.from("posts").remove([decodeURIComponent(path)]);
    }
    if (post.title) await supabase.from("post_topics").delete().eq("brand_id", post.brand_id).eq("topic", post.title);
    await supabase.from("posts").delete().eq("id", post.id);
    setPopup(null);
    setActionLoading("");
    router.refresh();
  };

  return (
    <div onClick={() => popup && setPopup(null)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={goPrev} className="p-2 hover:bg-surface-light rounded-lg transition-colors text-neutral-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <span className="text-sm text-neutral-400">{totalScheduled} programados</span>
          <button onClick={goNext} className="p-2 hover:bg-surface-light rounded-lg transition-colors text-neutral-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>

      {/* Desktop: Two months side by side */}
      <div className="hidden md:grid md:grid-cols-2 gap-6">
        <MonthGrid year={year} month={month} postsByDate={postsByDate} preferredDays={preferredDays} todayStr={todayStr} onPostAction={handlePostAction} />
        <MonthGrid year={nextYear} month={nextMonth} postsByDate={postsByDate} preferredDays={preferredDays} todayStr={todayStr} onPostAction={handlePostAction} />
      </div>

      {/* Mobile: Stacked */}
      <div className="md:hidden space-y-6">
        <MonthGrid year={year} month={month} postsByDate={postsByDate} preferredDays={preferredDays} todayStr={todayStr} onPostAction={handlePostAction} />
        <MonthGrid year={nextYear} month={nextMonth} postsByDate={postsByDate} preferredDays={preferredDays} todayStr={todayStr} onPostAction={handlePostAction} />
      </div>

      {/* Post action popup */}
      {popup && (
        <div
          className="fixed z-50 bg-surface-light border border-surface-border rounded-xl shadow-2xl p-3 w-52"
          style={{ top: Math.min(popup.y, window.innerHeight - 200), left: Math.min(popup.x, window.innerWidth - 220) }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-xs text-white font-medium truncate mb-2">{popup.post.title}</p>
          <p className="text-[10px] text-neutral-500 mb-3">{popup.post.status}</p>
          <div className="space-y-1">
            <Link
              href={`/dashboard/post/${popup.post.id}`}
              className="block w-full text-left text-xs text-neutral-300 hover:text-white px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
            >
              Ver post
            </Link>
            {popup.post.status === "SCHEDULED" && (
              <button
                onClick={handleUnschedule}
                disabled={!!actionLoading}
                className="block w-full text-left text-xs text-yellow-400 hover:text-yellow-300 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                {actionLoading === "unschedule" ? "..." : "Desprogramar"}
              </button>
            )}
            {popup.post.status !== "PUBLISHED" && (
              <button
                onClick={handleDelete}
                disabled={!!actionLoading}
                className="block w-full text-left text-xs text-red-400 hover:text-red-300 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                {actionLoading === "delete" ? "Eliminando..." : "Eliminar"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
