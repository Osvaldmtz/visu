import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const { brandId } = await request.json();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify brand ownership
  const { data: brand } = await supabase
    .from("brands")
    .select("id")
    .eq("id", brandId)
    .eq("user_id", user.id)
    .single();

  if (!brand) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

  // Find posts to delete: DISCARDED or image_url is null
  const { data: posts } = await supabase
    .from("posts")
    .select("id, image_url")
    .eq("brand_id", brandId)
    .or("status.eq.DISCARDED,image_url.is.null");

  if (!posts || posts.length === 0) {
    return NextResponse.json({ deleted: 0 });
  }

  // Use service role for storage deletion
  const adminClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Extract storage paths from image_urls and delete files
  const storagePaths: string[] = [];
  for (const post of posts) {
    if (post.image_url && post.image_url.includes("/storage/v1/object/public/posts/")) {
      const path = post.image_url.split("/storage/v1/object/public/posts/")[1];
      if (path) storagePaths.push(decodeURIComponent(path));
    }
  }

  if (storagePaths.length > 0) {
    const { error: storageError } = await adminClient.storage
      .from("posts")
      .remove(storagePaths);
    if (storageError) {
      console.error("Storage cleanup error:", storageError);
    }
  }

  // Delete posts from DB
  const postIds = posts.map((p) => p.id);
  const { error: deleteError } = await supabase
    .from("posts")
    .delete()
    .in("id", postIds);

  if (deleteError) {
    console.error("Post delete error:", deleteError);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }

  return NextResponse.json({ deleted: postIds.length });
}
