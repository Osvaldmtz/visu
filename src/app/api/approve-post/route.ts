import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const maxDuration = 30;

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file") as File;
  const brandId = formData.get("brandId") as string;
  const layout = formData.get("layout") as string;
  const title = formData.get("title") as string;
  const caption = formData.get("caption") as string;
  const subtitle = formData.get("subtitle") as string | null;
  const backgroundUrlField = formData.get("background_url") as string | null;
  const postId = formData.get("postId") as string | null;
  const scheduledAt = formData.get("scheduled_at") as string | null;
  const statusOverride = formData.get("status") as string | null;

  if (!file || !brandId) {
    return NextResponse.json({ error: "Missing file or brandId" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify brand access (RLS handles ownership + collaborator access)
  const { data: brand } = await supabase
    .from("brands")
    .select("id")
    .eq("id", brandId)
    .single();

  if (!brand) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

  // Use service role client for storage upload (bypasses RLS)
  const adminClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Upload PNG to Supabase Storage
  const fileName = `${brandId}/${Date.now()}-layout${layout}.png`;
  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  const { error: uploadError } = await adminClient.storage
    .from("posts")
    .upload(fileName, buffer, {
      contentType: "image/png",
      upsert: false,
    });

  if (uploadError) {
    console.error("Upload error:", uploadError);
    return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
  }

  const { data: { publicUrl } } = adminClient.storage
    .from("posts")
    .getPublicUrl(fileName);

  const postData: Record<string, any> = {
    brand_id: brandId,
    layout: parseInt(layout),
    image_url: publicUrl,
    caption: caption || "",
    title: title || "",
    status: statusOverride || "APPROVED",
    subtitle: subtitle || null,
    background_url: backgroundUrlField || null,
  };

  if (scheduledAt) {
    postData.scheduled_at = scheduledAt;
  }

  if (postId) {
    const { error } = await supabase.from("posts").update(postData).eq("id", postId);
    if (error) {
      console.error("Update error:", error);
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }
  } else {
    const { error } = await supabase.from("posts").insert(postData);
    if (error) {
      console.error("Insert error:", error);
      return NextResponse.json({ error: "Insert failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, imageUrl: publicUrl });
}
