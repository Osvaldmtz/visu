import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <h1 className="text-5xl font-bold tracking-tight mb-4">
        <span className="text-accent">Visu</span>
      </h1>
      <p className="text-lg text-neutral-400 mb-8 text-center max-w-md">
        AI-powered social content with human approval. Generate, review, publish.
      </p>
      <Link
        href="/login"
        className="bg-accent hover:bg-accent/90 text-white font-medium px-8 py-3 rounded-lg transition-colors"
      >
        Get started
      </Link>
    </div>
  );
}
