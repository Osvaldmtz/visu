// Test the /api/generate pipeline directly (without Next.js server)
// Replicates exactly what the route does

import { createClient } from '@supabase/supabase-js';

const SB_URL = 'https://ariroiycjuferrlxidla.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyaXJvaXljanVmZXJybHhpZGxhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzUxOTY4OCwiZXhwIjoyMDg5MDk1Njg4fQ.TnFQlDQECRvPgPfNdi55SkT1q0dplHPrR1HQgdSuhO8';
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;
const TEMPLATED_KEY = process.env.TEMPLATED_API_KEY;

const BRAND_ID = 'f48b8fc3-96ba-4fa4-8d74-bf70582bf52f';
const TEMPLATE_ID = '528e6dad-126a-4edc-9f5c-a0dc2390ddf7';
const LOGO = 'https://raw.githubusercontent.com/Osvaldmtz/kalyo-landing/main/assets/logo-white.svg';

const supabase = createClient(SB_URL, SB_KEY);

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Step 1: Claude
console.log('[1/4] Claude generating content...');
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
    system: 'You are the social media manager for Kalyo, a SaaS for clinical psychologists in Latin America. Write in professional Spanish (Latin American). Be concise.',
    messages: [{
      role: 'user',
      content: 'Create an educational post about a clinical assessment tool like PHQ-9. Include a specific clinical statistic.\n\nRespond ONLY with valid JSON:\n{\n  "title": "short text for image (max 6 words)",\n  "caption": "full caption for social media (max 280 chars)",\n  "hashtags": "#relevant #hashtags"\n}'
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
console.log(`  Caption: ${content.caption}`);

// Step 2: Gemini background
console.log('[2/4] Gemini generating background...');
const geminiRes = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${GOOGLE_AI_API_KEY}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: 'Generate a background image: A psychological assessment form and brain scan visualization, purple and violet color palette, dark moody clinical atmosphere, bokeh background, professional medical aesthetic, no people, photorealistic, square format' }] }],
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
console.log('[3/4] Templated rendering image...');
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
const imageUrl = renderData.render_url;
console.log(`  Image: ${imageUrl}`);

// Step 4: Save to Supabase
console.log('[4/4] Saving to Supabase...');
const { data: post, error } = await supabase.from('posts').insert({
  brand_id: BRAND_ID,
  layout: 0,
  image_url: imageUrl,
  caption: `${content.caption}\n\n${content.hashtags}`,
  title: content.title,
  status: 'DRAFT',
}).select().single();

if (error) {
  console.log(`  Error: ${error.message}`);
} else {
  console.log(`  Post saved! ID: ${post.id}`);
}

// Download and open
const { execSync } = await import('child_process');
execSync(`curl -s -o ~/Desktop/visu_kalyo_post.jpg "${imageUrl}"`);
execSync(`open ~/Desktop/visu_kalyo_post.jpg`);
console.log('\nDone! Image opened on Desktop.');
