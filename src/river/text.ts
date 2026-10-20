type Ctx = CanvasRenderingContext2D;

const segmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter('th', { granularity: 'word' })
    : undefined;

function tokens(text: string): string[] {
  if (segmenter) return Array.from(segmenter.segment(text), (s) => s.segment);
  return text.split(/(\s+)/);
}

/**
 * Wraps text to `maxWidth` using the context's current font. Thai has no spaces between
 * words, so Intl.Segmenter finds word boundaries; overly long tokens are split by character.
 */
export function wrapText(ctx: Ctx, text: string, maxWidth: number, maxLines: number): string[] {
  const lines: string[] = [];
  let line = '';
  const push = () => {
    lines.push(line.trim());
    line = '';
  };
  for (const tok of tokens(text.replace(/\s+/g, ' ').trim())) {
    if (ctx.measureText(line + tok).width <= maxWidth) {
      line += tok;
      continue;
    }
    if (line.trim()) push();
    if (ctx.measureText(tok).width <= maxWidth) {
      line = tok.trimStart();
      continue;
    }
    for (const ch of tok) {
      if (ctx.measureText(line + ch).width > maxWidth && line) push();
      line += ch;
    }
  }
  if (line.trim()) push();
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last.length > 1 && ctx.measureText(last + '…').width > maxWidth) last = last.slice(0, -1);
    kept[maxLines - 1] = last + '…';
    return kept;
  }
  return lines;
}

export function truncate(text: string, max: number): string {
  const chars = Array.from(text);
  return chars.length > max ? chars.slice(0, max - 1).join('') + '…' : text;
}

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(r, h / 2, w / 2));
}

export const FONT = '"Mali", "Sarabun", system-ui, sans-serif';
