"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const FONTS = ["Inter", "Poppins", "Montserrat", "Playfair Display", "Raleway"];
const DAY_LABELS = [
  { iso: 1, label: "Lun" },
  { iso: 2, label: "Mar" },
  { iso: 3, label: "Mié" },
  { iso: 4, label: "Jue" },
  { iso: 5, label: "Vie" },
  { iso: 6, label: "Sáb" },
  { iso: 7, label: "Dom" },
];

const TIMEZONES = [
  "America/Mexico_City",
  "America/Bogota",
  "America/Lima",
  "America/Santiago",
  "America/Argentina/Buenos_Aires",
  "America/Sao_Paulo",
  "America/Costa_Rica",
  "America/New_York",
];

export default function SettingsPage() {
  const router = useRouter();
  const lightInputRef = useRef<HTMLInputElement>(null);
  const darkInputRef = useRef<HTMLInputElement>(null);

  const [brand, setBrand] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [recommending, setRecommending] = useState(false);
  const [recommendation, setRecommendation] = useState<any>(null);

  // Form state
  const [name, setName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#7C3DE3");
  const [secondaryColor, setSecondaryColor] = useState("#1a1a1a");
  const [fontFamily, setFontFamily] = useState("Inter");
  const [industry, setIndustry] = useState("");
  const [igHandle, setIgHandle] = useState("");
  const [fbPage, setFbPage] = useState("");
  const [tiktokHandle, setTiktokHandle] = useState("");
  const [postsPerWeek, setPostsPerWeek] = useState(1);
  const [preferredDays, setPreferredDays] = useState<number[]>([1]);
  const [publishTime, setPublishTime] = useState("09:00");
  const [timezone, setTimezone] = useState("America/Mexico_City");
  const [logoLightPreview, setLogoLightPreview] = useState<string | null>(null);
  const [logoDarkPreview, setLogoDarkPreview] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data } = await supabase
        .from("brands")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (!data) { router.push("/onboarding"); return; }
      setBrand(data);
      setName(data.name || "");
      setPrimaryColor(data.primary_color || "#7C3DE3");
      setSecondaryColor(data.secondary_color || "#1a1a1a");
      setFontFamily(data.font_family || "Inter");
      setIndustry(data.industry || "");
      setIgHandle(data.ig_handle || "");
      setFbPage(data.fb_page || "");
      setTiktokHandle(data.tiktok_handle || "");
      setPostsPerWeek(data.posts_per_week || 1);
      setPreferredDays(data.preferred_days || [1]);
      const time = data.publish_time || "09:00:00";
      setPublishTime(time.slice(0, 5));
      setTimezone(data.timezone || "America/Mexico_City");
      setLogoLightPreview(data.logo_light_url || null);
      setLogoDarkPreview(data.logo_dark_url || null);
    };
    load();
  }, [router]);

  const toggleDay = (iso: number) => {
    setPreferredDays((prev) =>
      prev.includes(iso) ? prev.filter((d) => d !== iso) : [...prev, iso].sort()
    );
  };

  const handleLogoUpload = async (file: File, variant: "light" | "dark") => {
    if (!brand) return;
    const form = new FormData();
    form.append("file", file);
    form.append("brandId", brand.id);
    form.append("variant", variant);
    const res = await fetch("/api/upload-logo", { method: "POST", body: form });
    if (res.ok) {
      const data = await res.json();
      if (variant === "light") setLogoLightPreview(data.publicUrl);
      else setLogoDarkPreview(data.publicUrl);
    }
  };

  const handleSave = async () => {
    if (!brand) return;
    setSaving(true);
    setSaved(false);
    const supabase = createClient();
    await supabase
      .from("brands")
      .update({
        name,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        font_family: fontFamily,
        industry: industry || null,
        ig_handle: igHandle || null,
        fb_page: fbPage || null,
        tiktok_handle: tiktokHandle || null,
        posts_per_week: postsPerWeek,
        preferred_days: preferredDays,
        publish_time: publishTime,
        timezone,
      })
      .eq("id", brand.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleRecommend = async () => {
    if (!brand) return;
    setRecommending(true);
    setRecommendation(null);
    try {
      const res = await fetch("/api/recommend-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId: brand.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setRecommendation(data);
      }
    } finally {
      setRecommending(false);
    }
  };

  const applyRecommendation = () => {
    if (!recommendation) return;
    if (recommendation.days) setPreferredDays(recommendation.days);
    if (recommendation.time) setPublishTime(recommendation.time);
    setRecommendation(null);
  };

  if (!brand) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-neutral-400">Loading...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => router.push("/dashboard")}
          className="text-sm text-neutral-400 hover:text-white mb-6 block"
        >
          &larr; Back to dashboard
        </button>

        <h1 className="text-2xl font-bold mb-8">Settings</h1>

        <div className="space-y-8">
          {/* Brand name */}
          <Section title="Marca">
            <Field label="Nombre">
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Industria">
              <input
                type="text"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="Ej: Psicología clínica, Salud mental"
              />
            </Field>
          </Section>

          {/* Logos */}
          <Section title="Logos">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-neutral-500 mb-2 block">Logo claro (fondos oscuros)</label>
                <input
                  ref={lightInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleLogoUpload(f, "light");
                  }}
                />
                <div
                  onClick={() => lightInputRef.current?.click()}
                  className="border-2 border-dashed border-surface-border hover:border-accent/50 rounded-xl p-4 flex items-center justify-center cursor-pointer transition-colors min-h-[100px] bg-[#1a1a1a]"
                >
                  {logoLightPreview ? (
                    <img src={logoLightPreview} alt="Logo claro" className="max-h-16 max-w-full object-contain" />
                  ) : (
                    <span className="text-neutral-500 text-xs">Click para subir</span>
                  )}
                </div>
              </div>
              <div>
                <label className="text-xs text-neutral-500 mb-2 block">Logo oscuro (fondos claros)</label>
                <input
                  ref={darkInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleLogoUpload(f, "dark");
                  }}
                />
                <div
                  onClick={() => darkInputRef.current?.click()}
                  className="border-2 border-dashed border-surface-border hover:border-accent/50 rounded-xl p-4 flex items-center justify-center cursor-pointer transition-colors min-h-[100px] bg-[#e5e5e5]"
                >
                  {logoDarkPreview ? (
                    <img src={logoDarkPreview} alt="Logo oscuro" className="max-h-16 max-w-full object-contain" />
                  ) : (
                    <span className="text-neutral-400 text-xs">Click para subir</span>
                  )}
                </div>
              </div>
            </div>
          </Section>

          {/* Colors & Font */}
          <Section title="Identidad visual">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Color primario">
                <ColorPicker value={primaryColor} onChange={setPrimaryColor} />
              </Field>
              <Field label="Color secundario">
                <ColorPicker value={secondaryColor} onChange={setSecondaryColor} />
              </Field>
            </div>
            <Field label="Tipografia">
              <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)}>
                {FONTS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </Field>
          </Section>

          {/* Social */}
          <Section title="Redes sociales">
            <Field label="Instagram">
              <input type="text" value={igHandle} onChange={(e) => setIgHandle(e.target.value)} placeholder="@tu_marca" />
            </Field>
            <Field label="Facebook">
              <input type="text" value={fbPage} onChange={(e) => setFbPage(e.target.value)} placeholder="tu_marca" />
            </Field>
            <Field label="TikTok">
              <input type="text" value={tiktokHandle} onChange={(e) => setTiktokHandle(e.target.value)} placeholder="@tu_marca" />
            </Field>
          </Section>

          {/* Schedule */}
          <Section title="Publicacion">
            <Field label="Posts por semana">
              <select value={postsPerWeek} onChange={(e) => setPostsPerWeek(Number(e.target.value))}>
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </Field>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-neutral-500 uppercase tracking-wider">Dias preferidos</label>
              </div>
              <div className="flex gap-2">
                {DAY_LABELS.map(({ iso, label }) => (
                  <button
                    key={iso}
                    onClick={() => toggleDay(iso)}
                    className={`w-10 h-10 rounded-lg text-xs font-medium transition-colors ${
                      preferredDays.includes(iso)
                        ? "bg-accent text-white"
                        : "bg-surface-light text-neutral-400 border border-surface-border hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Hora de publicacion">
                <input type="time" value={publishTime} onChange={(e) => setPublishTime(e.target.value)} />
              </Field>
              <Field label="Zona horaria">
                <select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>{tz.replace("America/", "").replace(/_/g, " ")}</option>
                  ))}
                </select>
              </Field>
            </div>

            {/* AI Recommendation */}
            <div className="mt-2">
              <button
                onClick={handleRecommend}
                disabled={recommending}
                className="text-sm text-accent hover:text-accent/80 disabled:opacity-50 transition-colors"
              >
                {recommending ? "Analizando..." : "Recomendar horario con IA"}
              </button>

              {recommendation && (
                <div className="mt-3 p-4 bg-accent/5 border border-accent/20 rounded-xl">
                  <p className="text-sm text-neutral-300 mb-2">
                    <span className="font-medium text-accent">Recomendacion:</span>{" "}
                    {DAY_LABELS.filter((d) => recommendation.days?.includes(d.iso)).map((d) => d.label).join(", ")}
                    {" a las "}
                    {recommendation.time}
                  </p>
                  <p className="text-xs text-neutral-400 mb-3">{recommendation.reason}</p>
                  <button
                    onClick={applyRecommendation}
                    className="text-xs bg-accent hover:bg-accent/90 text-white px-4 py-1.5 rounded-lg transition-colors"
                  >
                    Aplicar recomendacion
                  </button>
                </div>
              )}
            </div>
          </Section>

          {/* Save */}
          <div className="flex items-center gap-4 pt-4 border-t border-surface-border">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-accent hover:bg-accent/90 disabled:opacity-50 text-white font-medium px-8 py-3 rounded-lg transition-colors text-sm"
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
            {saved && (
              <span className="text-sm text-green-400">Cambios guardados</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider mb-4">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-neutral-500 mb-1.5 block">{label}</span>
      <div className="[&_input]:w-full [&_input]:bg-surface-light [&_input]:border [&_input]:border-surface-border [&_input]:rounded-lg [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-white [&_input]:text-sm [&_input]:focus:outline-none [&_input]:focus:border-accent [&_input]:transition-colors [&_select]:w-full [&_select]:bg-surface-light [&_select]:border [&_select]:border-surface-border [&_select]:rounded-lg [&_select]:px-3 [&_select]:py-2.5 [&_select]:text-white [&_select]:text-sm [&_select]:focus:outline-none [&_select]:focus:border-accent [&_select]:transition-colors">
        {children}
      </div>
    </label>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-3 items-center bg-surface-light border border-surface-border rounded-lg px-3 py-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="!w-8 !h-8 !rounded !cursor-pointer !bg-transparent !border-0 !p-0"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="!flex-1 !border-0 !bg-transparent !p-0 !text-sm"
      />
    </div>
  );
}
