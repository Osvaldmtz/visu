"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const FONTS = ["Inter", "Poppins", "Montserrat", "Playfair Display", "Raleway"];

const LAYOUTS = [
  {
    id: "overlay",
    name: "Overlay",
    description:
      "Texto superpuesto sobre imagen de fondo con degradado sutil.",
  },
  {
    id: "split",
    name: "Split",
    description:
      "Imagen a un lado, texto y branding al otro. Limpio y profesional.",
  },
  {
    id: "minimal",
    name: "Minimalista",
    description:
      "Fondo sólido con tipografía protagonista. Ideal para frases.",
  },
  {
    id: "photo",
    name: "Foto real",
    description:
      "Foto generada con IA como elemento central. Máximo impacto visual.",
  },
];

const TOTAL_STEPS = 4;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState<"next" | "prev">("next");

  // Step 1 — Brand
  const [brandName, setBrandName] = useState("");
  const [logoLightFile, setLogoLightFile] = useState<File | null>(null);
  const [logoLightPreview, setLogoLightPreview] = useState<string | null>(null);
  const [logoDarkFile, setLogoDarkFile] = useState<File | null>(null);
  const [logoDarkPreview, setLogoDarkPreview] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState("#7C3DE3");
  const [secondaryColor, setSecondaryColor] = useState("#1a1a1a");
  const [font, setFont] = useState("Inter");

  // Step 2 — Layouts
  const [activeLayouts, setActiveLayouts] = useState<Record<string, boolean>>({
    overlay: true,
    split: true,
    minimal: true,
    photo: true,
  });

  // Step 3 — Social
  const [igHandle, setIgHandle] = useState("");
  const [fbPage, setFbPage] = useState("");
  const [tiktokHandle, setTiktokHandle] = useState("");

  const lightInputRef = useRef<HTMLInputElement>(null);
  const darkInputRef = useRef<HTMLInputElement>(null);

  const handleLogoSelect = useCallback(
    (file: File, variant: "light" | "dark") => {
      const reader = new FileReader();
      if (variant === "light") {
        setLogoLightFile(file);
        reader.onloadend = () => setLogoLightPreview(reader.result as string);
      } else {
        setLogoDarkFile(file);
        reader.onloadend = () => setLogoDarkPreview(reader.result as string);
      }
      reader.readAsDataURL(file);
    },
    []
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, variant: "light" | "dark") => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) handleLogoSelect(file, variant);
    },
    [handleLogoSelect]
  );

  const goNext = () => {
    setDirection("next");
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  };

  const goPrev = () => {
    setDirection("prev");
    setStep((s) => Math.max(s - 1, 1));
  };

  const toggleLayout = (id: string) =>
    setActiveLayouts((prev) => ({ ...prev, [id]: !prev[id] }));

  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      // Convert layout toggles to index array
      const layoutKeys = ["overlay", "split", "minimal", "photo"];
      const layoutIndexes = layoutKeys
        .map((k, i) => (activeLayouts[k] ? i : -1))
        .filter((i) => i >= 0);

      // 1. Create brand
      const { data: brand, error: brandErr } = await supabase
        .from("brands")
        .insert({
          user_id: user.id,
          name: brandName,
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          font_family: font,
          active_layouts: layoutIndexes,
          ig_handle: igHandle || null,
          fb_page: fbPage || null,
          tiktok_handle: tiktokHandle || null,
        })
        .select("id")
        .single();

      if (brandErr || !brand) throw new Error(brandErr?.message ?? "Brand creation failed");

      // 2. Upload logos via /api/upload-logo
      for (const [file, variant] of [
        [logoLightFile, "light"],
        [logoDarkFile, "dark"],
      ] as const) {
        if (!file) continue;
        const form = new FormData();
        form.append("file", file);
        form.append("brandId", brand.id);
        form.append("variant", variant);
        const res = await fetch("/api/upload-logo", { method: "POST", body: form });
        if (!res.ok) {
          const err = await res.json();
          console.error(`Logo upload (${variant}) failed:`, err);
        }
      }

      router.push("/dashboard");
    } catch (err) {
      console.error("Onboarding error:", err);
      setSaving(false);
    }
  };

  const canAdvance = () => {
    if (step === 1) return brandName.trim().length > 0 && logoLightFile !== null;
    if (step === 2)
      return Object.values(activeLayouts).some((v) => v);
    return true;
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Progress bar */}
      <div className="w-full h-1 bg-surface-light">
        <div
          className="h-full bg-accent transition-all duration-500 ease-out"
          style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
        />
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 pt-8 pb-2">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <div
            key={i}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors duration-300 ${
              i + 1 === step
                ? "bg-accent text-white"
                : i + 1 < step
                ? "bg-accent/30 text-accent"
                : "bg-surface-light text-neutral-500"
            }`}
          >
            {i + 1}
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center px-4 py-8">
        <div
          key={step}
          className={`w-full max-w-2xl animate-fade-in ${
            direction === "next" ? "animate-slide-left" : "animate-slide-right"
          }`}
        >
          {step === 1 && (
            <StepBrand
              brandName={brandName}
              setBrandName={setBrandName}
              logoLightPreview={logoLightPreview}
              logoDarkPreview={logoDarkPreview}
              primaryColor={primaryColor}
              setPrimaryColor={setPrimaryColor}
              secondaryColor={secondaryColor}
              setSecondaryColor={setSecondaryColor}
              font={font}
              setFont={setFont}
              lightInputRef={lightInputRef}
              darkInputRef={darkInputRef}
              onLogoSelect={handleLogoSelect}
              onDrop={handleDrop}
            />
          )}
          {step === 2 && (
            <StepLayouts
              layouts={LAYOUTS}
              activeLayouts={activeLayouts}
              toggleLayout={toggleLayout}
            />
          )}
          {step === 3 && (
            <StepSocial
              igHandle={igHandle}
              setIgHandle={setIgHandle}
              fbPage={fbPage}
              setFbPage={setFbPage}
              tiktokHandle={tiktokHandle}
              setTiktokHandle={setTiktokHandle}
            />
          )}
          {step === 4 && (
            <StepConfirm
              brandName={brandName}
              logoLightPreview={logoLightPreview}
              logoDarkPreview={logoDarkPreview}
              primaryColor={primaryColor}
              secondaryColor={secondaryColor}
              font={font}
              activeLayouts={activeLayouts}
              igHandle={igHandle}
              fbPage={fbPage}
              tiktokHandle={tiktokHandle}
            />
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="sticky bottom-0 bg-surface/80 backdrop-blur border-t border-surface-border px-4 py-4">
        <div className="max-w-2xl mx-auto flex justify-between">
          <button
            onClick={goPrev}
            className={`px-6 py-3 rounded-lg text-sm font-medium transition-colors ${
              step === 1
                ? "opacity-0 pointer-events-none"
                : "bg-surface-light hover:bg-surface-border text-neutral-300"
            }`}
          >
            Anterior
          </button>

          {step < TOTAL_STEPS ? (
            <button
              onClick={goNext}
              disabled={!canAdvance()}
              className="px-8 py-3 rounded-lg bg-accent hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
            >
              Siguiente
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={saving}
              className="px-8 py-3 rounded-lg bg-accent hover:bg-accent/90 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {saving ? "Guardando..." : "Crear mi marca"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Step 1: Brand ─── */

function LogoDropZone({
  preview,
  label,
  hint,
  bgColor,
  inputRef,
  onSelect,
  onDrop,
}: {
  preview: string | null;
  label: string;
  hint: string;
  bgColor: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onSelect: (file: File) => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onSelect(file);
          e.target.value = "";
        }}
      />
      <div
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-surface-border hover:border-accent/50 rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer transition-colors min-h-[140px]"
        style={{ backgroundColor: bgColor }}
      >
        {preview ? (
          <img
            src={preview}
            alt={label}
            className="max-h-20 max-w-full object-contain"
          />
        ) : (
          <>
            <svg
              className="w-7 h-7 text-neutral-500 mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 16v-8m0 0l-3 3m3-3l3 3M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1"
              />
            </svg>
            <span className="text-neutral-400 text-sm">{label}</span>
            <span className="text-neutral-600 text-xs mt-1">{hint}</span>
          </>
        )}
      </div>
    </>
  );
}

function StepBrand({
  brandName,
  setBrandName,
  logoLightPreview,
  logoDarkPreview,
  primaryColor,
  setPrimaryColor,
  secondaryColor,
  setSecondaryColor,
  font,
  setFont,
  lightInputRef,
  darkInputRef,
  onLogoSelect,
  onDrop,
}: {
  brandName: string;
  setBrandName: (v: string) => void;
  logoLightPreview: string | null;
  logoDarkPreview: string | null;
  primaryColor: string;
  setPrimaryColor: (v: string) => void;
  secondaryColor: string;
  setSecondaryColor: (v: string) => void;
  font: string;
  setFont: (v: string) => void;
  lightInputRef: React.RefObject<HTMLInputElement | null>;
  darkInputRef: React.RefObject<HTMLInputElement | null>;
  onLogoSelect: (file: File, variant: "light" | "dark") => void;
  onDrop: (e: React.DragEvent, variant: "light" | "dark") => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Tu marca</h1>
        <p className="text-neutral-400 text-sm">
          Define la identidad visual de tu contenido.
        </p>
      </div>

      {/* Brand name */}
      <Field label="Nombre de la marca" required>
        <input
          type="text"
          value={brandName}
          onChange={(e) => setBrandName(e.target.value)}
          placeholder="Ej: Kalyo"
        />
      </Field>

      {/* Logo uploads */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Logo claro" required>
          <LogoDropZone
            preview={logoLightPreview}
            label="Para fondos oscuros"
            hint="PNG o SVG (blanco)"
            bgColor="#1a1a1a"
            inputRef={lightInputRef}
            onSelect={(f) => onLogoSelect(f, "light")}
            onDrop={(e) => onDrop(e, "light")}
          />
        </Field>
        <Field label="Logo oscuro">
          <LogoDropZone
            preview={logoDarkPreview}
            label="Para fondos claros"
            hint="PNG o SVG (oscuro)"
            bgColor="#e5e5e5"
            inputRef={darkInputRef}
            onSelect={(f) => onLogoSelect(f, "dark")}
            onDrop={(e) => onDrop(e, "dark")}
          />
        </Field>
      </div>

      {/* Colors */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Color primario">
          <ColorPicker value={primaryColor} onChange={setPrimaryColor} />
        </Field>
        <Field label="Color secundario">
          <ColorPicker value={secondaryColor} onChange={setSecondaryColor} />
        </Field>
      </div>

      {/* Font */}
      <Field label="Tipografia">
        <select value={font} onChange={(e) => setFont(e.target.value)}>
          {FONTS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}

/* ─── Step 2: Layouts ─── */

function StepLayouts({
  layouts,
  activeLayouts,
  toggleLayout,
}: {
  layouts: typeof LAYOUTS;
  activeLayouts: Record<string, boolean>;
  toggleLayout: (id: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Layouts</h1>
        <p className="text-neutral-400 text-sm">
          Elige qué estilos de publicación quieres generar.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {layouts.map((layout) => {
          const active = activeLayouts[layout.id];
          return (
            <div
              key={layout.id}
              className={`relative rounded-xl border p-5 transition-all duration-200 ${
                active
                  ? "border-accent/60 bg-accent/5"
                  : "border-surface-border bg-surface-light opacity-60"
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-white">{layout.name}</h3>
                {/* Toggle */}
                <button
                  onClick={() => toggleLayout(layout.id)}
                  className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                    active ? "bg-accent" : "bg-surface-border"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200 ${
                      active ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
              <p className="text-neutral-400 text-sm leading-relaxed mb-4">
                {layout.description}
              </p>
              <button className="text-accent text-sm font-medium hover:underline">
                Preview
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Step 3: Social ─── */

function StepSocial({
  igHandle,
  setIgHandle,
  fbPage,
  setFbPage,
  tiktokHandle,
  setTiktokHandle,
}: {
  igHandle: string;
  setIgHandle: (v: string) => void;
  fbPage: string;
  setFbPage: (v: string) => void;
  tiktokHandle: string;
  setTiktokHandle: (v: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Redes sociales</h1>
        <p className="text-neutral-400 text-sm">
          Visu publicará automáticamente en tus cuentas. Nos contactaremos para
          completar la conexión.
        </p>
      </div>

      <Field label="Instagram handle">
        <input
          type="text"
          value={igHandle}
          onChange={(e) => setIgHandle(e.target.value)}
          placeholder="@tu_marca"
        />
      </Field>

      <Field label="Facebook page">
        <input
          type="text"
          value={fbPage}
          onChange={(e) => setFbPage(e.target.value)}
          placeholder="tu_marca"
        />
      </Field>

      <Field label="TikTok handle (opcional)">
        <input
          type="text"
          value={tiktokHandle}
          onChange={(e) => setTiktokHandle(e.target.value)}
          placeholder="@tu_marca"
        />
      </Field>
    </div>
  );
}

/* ─── Step 4: Confirm ─── */

function StepConfirm({
  brandName,
  logoLightPreview,
  logoDarkPreview,
  primaryColor,
  secondaryColor,
  font,
  activeLayouts,
  igHandle,
  fbPage,
  tiktokHandle,
}: {
  brandName: string;
  logoLightPreview: string | null;
  logoDarkPreview: string | null;
  primaryColor: string;
  secondaryColor: string;
  font: string;
  activeLayouts: Record<string, boolean>;
  igHandle: string;
  fbPage: string;
  tiktokHandle: string;
}) {
  const enabledLayouts = LAYOUTS.filter((l) => activeLayouts[l.id]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Confirmar</h1>
        <p className="text-neutral-400 text-sm">
          Revisa tu configuración antes de crear la marca.
        </p>
      </div>

      {/* Brand preview card */}
      <div className="rounded-xl border border-surface-border bg-surface-light p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex gap-2">
            {logoLightPreview ? (
              <div className="w-14 h-14 rounded-xl flex items-center justify-center overflow-hidden bg-[#1a1a1a]">
                <img
                  src={logoLightPreview}
                  alt="Logo claro"
                  className="max-w-[40px] max-h-[40px] object-contain"
                />
              </div>
            ) : (
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold text-white"
                style={{ backgroundColor: primaryColor }}
              >
                {brandName.charAt(0).toUpperCase()}
              </div>
            )}
            {logoDarkPreview && (
              <div className="w-14 h-14 rounded-xl flex items-center justify-center overflow-hidden bg-[#e5e5e5]">
                <img
                  src={logoDarkPreview}
                  alt="Logo oscuro"
                  className="max-w-[40px] max-h-[40px] object-contain"
                />
              </div>
            )}
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">{brandName}</h2>
            <p className="text-neutral-400 text-sm" style={{ fontFamily: font }}>
              {font}
            </p>
          </div>
        </div>

        {/* Colors */}
        <div className="flex gap-3 mb-6">
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-full border border-white/10"
              style={{ backgroundColor: primaryColor }}
            />
            <span className="text-xs text-neutral-400">{primaryColor}</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-full border border-white/10"
              style={{ backgroundColor: secondaryColor }}
            />
            <span className="text-xs text-neutral-400">{secondaryColor}</span>
          </div>
        </div>

        {/* Layouts */}
        <div className="mb-6">
          <span className="text-xs text-neutral-500 uppercase tracking-wider">
            Layouts activos
          </span>
          <div className="flex flex-wrap gap-2 mt-2">
            {enabledLayouts.map((l) => (
              <span
                key={l.id}
                className="text-xs px-3 py-1 rounded-full bg-accent/10 text-accent border border-accent/20"
              >
                {l.name}
              </span>
            ))}
          </div>
        </div>

        {/* Social */}
        <div>
          <span className="text-xs text-neutral-500 uppercase tracking-wider">
            Redes sociales
          </span>
          <div className="mt-2 space-y-1 text-sm text-neutral-300">
            {igHandle && <p>Instagram: {igHandle}</p>}
            {fbPage && <p>Facebook: {fbPage}</p>}
            {tiktokHandle && <p>TikTok: {tiktokHandle}</p>}
            {!igHandle && !fbPage && !tiktokHandle && (
              <p className="text-neutral-500">No configurado</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Shared components ─── */

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm text-neutral-300 mb-1.5 block">
        {label}
        {required && <span className="text-accent ml-1">*</span>}
      </span>
      <div className="[&_input]:w-full [&_input]:bg-surface-light [&_input]:border [&_input]:border-surface-border [&_input]:rounded-lg [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-white [&_input]:placeholder-neutral-500 [&_input]:focus:outline-none [&_input]:focus:border-accent [&_input]:transition-colors [&_select]:w-full [&_select]:bg-surface-light [&_select]:border [&_select]:border-surface-border [&_select]:rounded-lg [&_select]:px-3 [&_select]:py-2.5 [&_select]:text-white [&_select]:focus:outline-none [&_select]:focus:border-accent [&_select]:transition-colors">
        {children}
      </div>
    </label>
  );
}

function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
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
