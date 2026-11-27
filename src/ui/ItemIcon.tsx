import { PIXEL_ICONS, type PixelIcon } from './pixelIcons';

/**
 * Item icons: a pixel-art icon when `icon` names one in pixelIcons.ts (e.g. 'plank'), otherwise the
 * text itself (an emoji). Pixel icons are drawn as crisp SVG, one path per colour, sized to the text.
 */

const cache = new Map<string, { fill: string; d: string }[]>();

function pathsFor(name: string, icon: PixelIcon) {
  let paths = cache.get(name);
  if (!paths) {
    const byColour = new Map<string, string>();
    icon.rows.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        const fill = icon.palette[ch as keyof typeof icon.palette];
        if (fill) byColour.set(fill, `${byColour.get(fill) ?? ''}M${x} ${y}h1v1h-1z`);
      }),
    );
    paths = [...byColour].map(([fill, d]) => ({ fill, d }));
    cache.set(name, paths);
  }
  return paths;
}

export function ItemIcon({ icon }: { icon: string }) {
  const pixel = (PIXEL_ICONS as Record<string, PixelIcon>)[icon];
  if (!pixel) return <>{icon}</>;
  return (
    <svg
      viewBox={`0 0 ${pixel.rows[0].length} ${pixel.rows.length}`}
      width="1.1em"
      height="1.1em"
      shapeRendering="crispEdges"
      aria-hidden="true"
      style={{ verticalAlign: '-0.2em' }}
    >
      {pathsFor(icon, pixel).map((p) => (
        <path key={p.fill} fill={p.fill} d={p.d} />
      ))}
    </svg>
  );
}
