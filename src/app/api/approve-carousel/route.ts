import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const maxDuration = 60;

export async function POST(request: Request) {
  const formData = await request.formData();
  const brandId = formData.get("brandId") as string;
  const caption = formData.get("caption") as string;
  const format = formData.get("format") as string;
  const status = formData.get("status") as string;
  const slidesJson = formData.get("slides") as string;
  const slideCount = parseInt(formData.get("slideCount") as string);
  const carouselId = formData.get("carouselId") as string | null;

  if (!brandId || !slidesJson || !slideCount) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify brand access
  const { data: brand } = await supabase
    .from("brands")
    .select("id")
    .eq("id", brandId)
    .single();

  if (!brand) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

  // Use service role client for storage upload
  const adminClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const timestamp = Date.now();
  const imageUrls: string[] = [];

  // Upload each slide's PNG
  for (let i = 0; i < slideCount; i++) {
    const file = formData.get(`file_${i}`) as File;
    if (!file) {
      return NextResponse.json({ error: `Missing file for slide ${i}` }, { status: 400 });
    }

    const fileName = `${brandId}/carousel-${timestamp}-slide${i}.png`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const { error: uploadError } = await adminClient.storage
      .from("posts")
      .upload(fileName, buffer, {
        contentType: "image/png",
        upsert: false,
      });

    if (uploadError) {
      console.error(`Upload error slide ${i}:`, uploadError);
      return NextResponse.json({ error: `Upload failed for slide ${i}: ${uploadError.message}` }, { status: 500 });
    }

    const { data: { publicUrl } } = adminClient.storage
      .from("posts")
      .getPublicUrl(fileName);

    imageUrls.push(publicUrl);
  }

  // Parse slides and strip base64 background_urls (we only need external URLs in DB)
  const slides = JSON.parse(slidesJson).map((s: any) => ({
    ...s,
    background_url: s.background_url?.startsWith("data:") ? "" : s.background_url,
  }));

  const carouselData = {
    brand_id: brandId,
    caption: caption || "",
    status: status || "APPROVED",
    format: format || "square",
    slides,
    image_urls: imageUrls,
    updated_at: new Date().toISOString(),
  };

  let savedId = carouselId;

  if (carouselId) {
    const { error } = await supabase
      .from("carousel_posts")
      .update(carouselData)
      .eq("id", carouselId);
    if (error) {
      console.error("Update error:", error);
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }
  } else {
    const { data: inserted, error } = await supabase
      .from("carousel_posts")
      .insert(carouselData)
      .select("id")
      .single();
    if (error) {
      console.error("Insert error:", error);
      return NextResponse.json({ error: "Insert failed" }, { status: 500 });
    }
    savedId = inserted.id;
  }

  return NextResponse.json({ ok: true, carouselId: savedId, imageUrls });
}
