import { createClient } from '@supabase/supabase-js';

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;
const TEMPLATED_KEY = process.env.TEMPLATED_API_KEY;

const supabase = createClient(SB_URL, SB_KEY);
const BRAND_ID = 'f48b8fc3-96ba-4fa4-8d74-bf70582bf52f';
const LOGO_WHITE = 'https://raw.githubusercontent.com/Osvaldmtz/kalyo-landing/main/assets/logo-white.svg';
const LOGO_PURPLE = 'https://raw.githubusercontent.com/Osvaldmtz/kalyo-landing/main/assets/logo-purple.svg';

const TEMPLATES = [
  process.env.TEMPLATED_TEMPLATE_0,
  process.env.TEMPLATED_TEMPLATE_1,
  process.env.TEMPLATED_TEMPLATE_2,
  process.env.TEMPLATED_TEMPLATE_3,
];
const LAYOUT_NAMES = ['Overlay', 'Split', 'Minimal', 'Foto'];

const PROMPTS = [
  'Crea un post educativo sobre uno de estos tests: PHQ-9, GAD-7, BAI, PCL-5. Incluye un dato clinico especifico sobre su sensibilidad o punto de corte validado.',
  'Crea un post mostrando el tiempo real que Kalyo ahorra al psicologo. Usa numeros concretos y contrasta el antes (papel) vs despues (Kalyo).',
  'Crea un post que conecte con el dolor del psicologo ante el papeleo y la documentacion. Que sienta que lo entiendes antes de mencionar Kalyo.',
  'Crea un post mostrando una funcion especifica de Kalyo: reportes con IA, mapa de riesgo, interpretacion DSM-5 o expediente digital.',
];

const BG_PROMPTS = [
  'Generate a background image: A psychological assessment form and brain scan visualization, purple and violet color palette, dark moody clinical atmosphere, bokeh background, professional medical aesthetic, no people, photorealistic, square format',
  'Generate a background image: Hourglass with glowing purple light, digital calendar and clock elements, time concept visualization, deep purple gradient background, modern minimal, no people, photorealistic, square format',
  null,
  'Generate a background image: Futuristic medical dashboard interface with purple glowing screens, neural network visualization, clinical AI technology concept, dark background, no people, photorealistic, square format',
];

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function generateContent(prompt, needsSubtitle) {
  const sub = needsSubtitle ? '  "subtitle": "frase secundaria corta (max 10 palabras)",\n' : '';
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001', max_tokens: 512,
      system: 'Eres el community manager de Kalyo (kalyo.io), plataforma SaaS para psicologos clinicos en Latinoamerica. Escribe en espanol profesional, clinico, sin hype.',
      messages: [{ role: 'user', content: `${prompt}\n\nResponde SOLO con JSON valido:\n{\n  "title": "texto corto (max 6 palabras)",\n${sub}  "caption": "caption (max 280 chars)",\n  "hashtags": "#hashtags relevantes"\n}` }]
    })
  });
  const d = await res.json();
  let raw = d.content[0].text.trim();
  if (raw.startsWith('```')) { raw = raw.split('\n').slice(1).join('\n'); if (raw.endsWith('```')) raw = raw.slice(0, -3).trim(); }
  return JSON.parse(raw);
}

async function generateBackground(prompt) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${GOOGLE_AI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['IMAGE', 'TEXT'], responseMimeType: 'text/plain' },
      }),
    }
  );
  const data = await res.json();
  const imagePart = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
  if (!imagePart) return null;
  const { mimeType, data: b64 } = imagePart.inlineData;
  return `data:${mimeType};base64,${b64}`;
}

async function render(templateId, layers) {
  const res = await fetch('https://api.templated.io/v1/render', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TEMPLATED_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ template: templateId, layers })
  });
  return (await res.json()).render_url;
}

// ─── Main ────────────────────────────────────────────────────────────────────

console.log('=== Generating 4 Kalyo posts ===\n');

for (let idx = 0; idx < 4; idx++) {
  console.log(`[Layout ${idx}] ${LAYOUT_NAMES[idx]}`);

  // 1. Content
  const needsSub = idx === 1 || idx === 2;
  const content = await generateContent(PROMPTS[idx], needsSub);
  console.log(`  Title: ${content.title}`);

  // 2. Background
  let bgUrl = null;
  if (BG_PROMPTS[idx]) {
    console.log('  Generating Gemini background...');
    bgUrl = await generateBackground(BG_PROMPTS[idx]);
  }

  // 3. Build layers per layout
  let layers = {};
  if (idx === 0) {
    layers = { title: { text: content.title }, logo: { image_url: LOGO_WHITE } };
    if (bgUrl) layers.background = { image_url: bgUrl };
  } else if (idx === 1) {
    layers = { title: { text: content.title }, subtitle: { text: content.subtitle || 'kalyo.io' }, logo: { image_url: LOGO_WHITE } };
    if (bgUrl) layers.background = { image_url: bgUrl };
  } else if (idx === 2) {
    layers = { title: { text: content.title }, subtitle: { text: content.subtitle || 'kalyo.io' }, logo: { image_url: LOGO_PURPLE } };
  } else {
    layers = {
      title: { text: content.title, x: 72, y: 72, width: 700, height: 300, horizontal_align: 'left', vertical_align: 'top' },
      overlay: { hide: true },
      logo: { image_url: LOGO_WHITE, x: 860, y: 950, width: 160, height: 68 },
    };
    if (bgUrl) layers.background = { image_url: bgUrl };
  }

  // 4. Render
  console.log('  Rendering...');
  const imageUrl = await render(TEMPLATES[idx], layers);
  console.log(`  Image: ${imageUrl}`);

  // 5. Save to Supabase
  const { data: post, error } = await supabase.from('posts').insert({
    brand_id: BRAND_ID, layout: idx, image_url: imageUrl,
    caption: `${content.caption}\n\n${content.hashtags}`,
    title: content.title, status: 'DRAFT',
  }).select('id').single();

  if (error) console.log(`  DB Error: ${error.message}`);
  else console.log(`  Saved: ${post.id}`);

  // Download
  const { execSync } = await import('child_process');
  execSync(`curl -s -o ~/Desktop/visu_layout${idx}_${LAYOUT_NAMES[idx].toLowerCase()}.jpg "${imageUrl}"`);
  console.log('');
}

// Open all
const { execSync } = await import('child_process');
execSync('open ~/Desktop/visu_layout0_overlay.jpg ~/Desktop/visu_layout1_split.jpg ~/Desktop/visu_layout2_minimal.jpg ~/Desktop/visu_layout3_foto.jpg');
console.log('=== Done! 4 posts saved as DRAFT, images on Desktop ===');
