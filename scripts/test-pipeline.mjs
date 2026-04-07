// Test the full generation pipeline without Supabase tables
// Generates 1 post image via Claude + FAL + Templated

// Set these as env vars before running: ANTHROPIC_API_KEY, GOOGLE_AI_API_KEY, TEMPLATED_API_KEY
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;
const TEMPLATED_KEY = process.env.TEMPLATED_API_KEY;
const TEMPLATE_ID = process.env.TEMPLATED_TEMPLATE_0 || '528e6dad-126a-4edc-9f5c-a0dc2390ddf7';
const LOGO = 'https://raw.githubusercontent.com/Osvaldmtz/kalyo-landing/main/assets/logo-white.svg';

if (!ANTHROPIC_KEY || !GOOGLE_AI_API_KEY || !TEMPLATED_KEY) {
  console.error('Missing env vars. Run with: source .env.local && node scripts/test-pipeline.mjs');
  process.exit(1);
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Step 1: Claude
console.log('[1/3] Claude generating content...');
const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'x-api-key': ANTHROPIC_KEY,
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: 'You are a social media manager for Visu, an AI content platform. Write in professional Spanish.',
    messages: [{
      role: 'user',
      content: 'Create an educational post about AI in social media.\n\nRespond ONLY with valid JSON:\n{\n  "title": "short text (max 6 words)",\n  "caption": "full caption (max 280 chars)",\n  "hashtags": "#relevant #hashtags"\n}'
    }]
  })
});
const claudeData = await claudeRes.json();
let raw = claudeData.content[0].text.trim();
if (raw.startsWith('```')) {
  raw = raw.split('\n').slice(1).join('\n');
  if (raw.endsWith('```')) raw = raw.slice(0, -3).trim();
}
const content = JSON.parse(raw);
console.log(`  Title: ${content.title}`);
console.log(`  Caption: ${content.caption.slice(0, 80)}...`);

// Step 2: Gemini background
console.log('[2/3] Gemini generating background...');
const geminiRes = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${GOOGLE_AI_API_KEY}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: 'Generate a background image: Pure deep purple gradient background, smooth bokeh light spots, no objects no people no text, minimal abstract, square format' }] }],
      generationConfig: { responseModalities: ['IMAGE', 'TEXT'], responseMimeType: 'text/plain' },
    }),
  }
);
const geminiData = await geminiRes.json();
const imagePart = geminiData.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
let bgUrl = null;
if (imagePart) {
  const { mimeType, data: b64 } = imagePart.inlineData;
  bgUrl = `data:${mimeType};base64,${b64}`;
  console.log(`  Background: [base64 data URL, ${Math.round(b64.length / 1024)}KB]`);
} else {
  console.log('  Background: null (no image returned)');
}

// Step 3: Templated render
console.log('[3/3] Templated rendering image...');
const renderRes = await fetch('https://api.templated.io/v1/render', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${TEMPLATED_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    template: TEMPLATE_ID,
    layers: {
      title: { text: content.title },
      background: { image_url: bgUrl },
      logo: { image_url: LOGO },
    }
  })
});
const renderData = await renderRes.json();
console.log(`  Image URL: ${renderData.render_url}`);

// Download
const { execSync } = await import('child_process');
const path = `${process.env.HOME}/Desktop/visu_test_post.jpg`;
execSync(`curl -s -o "${path}" "${renderData.render_url}"`);
execSync(`open "${path}"`);
console.log(`\n✅ Done! Saved to ${path}`);
