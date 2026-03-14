import { NextResponse } from "next/server";

const TEMPLATE_IDS = [
  "528e6dad-126a-4edc-9f5c-a0dc2390ddf7",
  "2aa508b9-d30a-4a9a-840d-26cdd3ff5804",
  "60d757a9-e7ec-4ff4-92ac-47e2655c2c43",
  "528e6dad-126a-4edc-9f5c-a0dc2390ddf7",
];

const SAMPLE_TITLES = [
  "Tu bienestar importa",
  "Agenda tu cita hoy",
  "Cuida tu salud mental",
  "Conoce nuestros servicios",
];

export async function POST(request: Request) {
  try {
    const { layoutId, brandConfig } = await request.json();

    if (layoutId < 0 || layoutId > 3) {
      return NextResponse.json({ error: "Invalid layoutId" }, { status: 400 });
    }

    const templateId = TEMPLATE_IDS[layoutId];

    const layers: Record<string, any> = {
      title: { text: SAMPLE_TITLES[layoutId] },
    };

    if (brandConfig.logoUrl) {
      layers.logo = { image_url: brandConfig.logoUrl };
    }

    if (brandConfig.primaryColor) {
      layers["primary-color"] = { color: brandConfig.primaryColor };
    }

    if (layoutId === 1 || layoutId === 2) {
      layers.subtitle = { text: `by ${brandConfig.name}` };
    }

    const res = await fetch("https://api.templated.io/v1/render", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.TEMPLATED_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ template: templateId, layers }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json(
        { error: "Templated API error", detail: err },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json({ imageUrl: data.render_url });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Internal error" },
      { status: 500 }
    );
  }
}
