const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-yellow-500/20 text-yellow-400",
  APPROVED: "bg-green-500/20 text-green-400",
  SCHEDULED: "bg-blue-500/20 text-blue-400",
  PUBLISHED: "bg-accent/20 text-accent",
  DISCARDED: "bg-red-500/20 text-red-400",
};

const LAYOUT_NAMES = ["Overlay", "Split", "Minimal", "Foto"];

export function PostCard({ post }: { post: any }) {
  return (
    <div className="bg-surface-light border border-surface-border rounded-xl overflow-hidden hover:border-accent/50 transition-colors group">
      {post.image_url ? (
        <div className="aspect-square bg-neutral-800 relative overflow-hidden">
          <img
            src={post.image_url}
            alt={post.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      ) : (
        <div className="aspect-square bg-neutral-800 flex items-center justify-center">
          <span className="text-neutral-500 text-sm">No image</span>
        </div>
      )}
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-neutral-500">{LAYOUT_NAMES[post.layout]}</span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[post.status] ?? ""}`}
          >
            {post.status}
          </span>
        </div>
        <p className="text-sm text-neutral-300 line-clamp-2">{post.caption}</p>
      </div>
    </div>
  );
}
