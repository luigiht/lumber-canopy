import Game from '@/game/Game';
import { SITE, SITE_URL } from '@/config/site';

/** Structured data so search engines and AI assistants can describe the game accurately. */
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE.name,
      description: SITE.description,
      inLanguage: SITE.language,
    },
    {
      '@type': 'VideoGame',
      '@id': `${SITE_URL}/#game`,
      name: SITE.name,
      url: SITE_URL,
      description: SITE.about,
      abstract: SITE.description,
      image: `${SITE_URL}/opengraph-image.jpg`,
      screenshot: `${SITE_URL}/brand/background-intro.png`,
      genre: SITE.genres,
      keywords: SITE.keywords.join(', '),
      featureList: SITE.features,
      gamePlatform: ['Web browser', 'Desktop', 'Mobile'],
      applicationCategory: 'GameApplication',
      operatingSystem: 'Any (runs in a modern web browser)',
      playMode: 'SinglePlayer',
      numberOfPlayers: { '@type': 'QuantitativeValue', value: 1 },
      inLanguage: SITE.language,
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD', availability: 'https://schema.org/InStock' },
      isPartOf: { '@id': `${SITE_URL}/#website` },
    },
  ],
};

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      {/* A plain description of the game for screen readers, search engines and AI assistants. */}
      <section className="visually-hidden" aria-labelledby="about-game">
        <h1 id="about-game">{SITE.name}</h1>
        <p>{SITE.description}</p>
        <p>{SITE.about}</p>
        <h2>Features</h2>
        <ul>
          {SITE.features.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </section>
      <Game />
    </>
  );
}
