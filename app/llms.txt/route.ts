import { SITE, SITE_URL } from '@/config/site';

/** llms.txt: a plain-text summary of the game for AI assistants and answer engines. */
export const dynamic = 'force-static';

export function GET() {
  const body = [
    `# ${SITE.name}`,
    '',
    `> ${SITE.description}`,
    '',
    SITE.about,
    '',
    '## Features',
    ...SITE.features.map((f) => `- ${f}`),
    '',
    '## Facts',
    `- Genre: ${SITE.genres.join(', ')}`,
    '- Platform: web browser (desktop and mobile); no download needed',
    '- Players: single player',
    '- Price: free',
    '- Saves: to your account (email and password), so you can continue on any device',
    '',
    '## Links',
    `- [Play ${SITE.name}](${SITE_URL}/)`,
    `- [Privacy](${SITE_URL}/privacy): we only use your email to save your game`,
    '',
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
