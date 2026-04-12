import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

export async function POST(request: Request) {
  const { title, caption, primaryColor, format } = await request.json();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GOOGLE_AI_API_KEY not configured" }, { status: 500 });

  const context = [title, caption?.split("\n")[0]].filter(Boolean).join(". ");
  const formatDesc = format === "story" ? "vertical 9:16 story format" : format === "portrait" ? "portrait 4:5 vertical format" : "square format";
  const prompt = `Generate a background image that visually represents: "${context}". Use ${primaryColor || "#7C3DE3"} tones, no text, no people, professional, clean background, high quality, ${formatDesc}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ["IMAGE", "TEXT"],
            responseMimeType: "text/plain",
          },
        }),
      }
    );

    if (!res.ok) {
      const errBody = await res.text();
      console.error("Gemini image error:", res.status, errBody);
      return NextResponse.json({ error: `Gemini error: ${res.status}` }, { status: 502 });
    }

    const data = await res.json();
    const parts = data.candidates?.[0]?.content?.parts;
    const imagePart = parts?.find((p: any) => p.inlineData);

    if (!imagePart) {
      return NextResponse.json({ error: "No image returned from Gemini" }, { status: 502 });
    }

    const { mimeType, data: b64 } = imagePart.inlineData;
    return NextResponse.json({ backgroundUrl: `data:${mimeType};base64,${b64}` });
  } catch (e: any) {
    console.error("Gemini image error:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
