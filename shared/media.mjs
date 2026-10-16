import ipaddr from 'ipaddr.js';

export const imageSlots = ['hero', 'wedding', 'story', 'portrait', 'celebration', 'dress', 'beauty', 'cosplay'];
export const MAX_POST_IMAGES = 9;

/** @param {unknown} value @returns {string | null} */
export function imageURL(value) {
  if (typeof value !== 'string' || value.length > 2048 || /[\s\\<>"'`]/.test(value)) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase().replace(/\.$/, '');
    if (url.protocol !== 'https:' || url.username || url.password || url.hash || (url.port && url.port !== '443')) return null;
    if (!host.includes('.') && !host.includes(':')) return null;
    if (/(^|\.)(localhost|local|internal|lan|test|invalid|onion)$/.test(host) || host.endsWith('.localhost.')) return null;
    if (ipaddr.isValid(host) && ipaddr.process(host).range() !== 'unicast') return null;
    if (/\.(?:svg|html?|js|php)(?:$|\/)/i.test(url.pathname)) return null;
    return url.href;
  } catch { return null; }
}
/** @param {unknown} value */
export function siteImageURL(value) {
  return typeof value === 'string' && imageSlots.some(slot => value === `/images/${slot}.jpg`)
    ? value : imageURL(value);
}
/** Parse only image syntax, never HTML or arbitrary Markdown. @param {string} body */
export function parsePostImages(body) {
  const pattern = /!\[([^\]\n]{0,160})\]\(<?(https:\/\/[^\s<>]+?)>?(?:\s+"[^"\n]*")?\)|\[img(?:=[^\]\n]{1,40})?\]\s*(https:\/\/[^\s<>]+?)\s*\[\/img\]|https:\/\/[^\s<>"'\x60\[\]]+/gi;
  /** @type {{type: 'text' | 'image', value: string, alt?: string}[]} */
  const segments = [];
  let cursor = 0;
  for (const match of body.matchAll(pattern)) {
    const candidate = match[2] || match[3] || match[0].replace(/[.,;!，。；！）]+$/, '');
    if (!match[2] && !match[3] && !/\.(?:jpe?g|png|gif|webp|avif)(?:\?|$)/i.test(candidate)) continue;
    const url = imageURL(candidate);
    if (!url) continue;
    const start = match.index;
    if (start > cursor) segments.push({type: 'text', value: body.slice(cursor, start)});
    segments.push({type: 'image', value: url, alt: match[1] || ''});
    cursor = start + (match[2] || match[3] ? match[0].length : candidate.length);
  }
  if (cursor < body.length) segments.push({type: 'text', value: body.slice(cursor)});
  return segments;
}
/** @param {string[]} values */
export function parseImageLinks(values) {
  return [...new Set(values.flatMap(value => {
    const direct = imageURL(value.trim());
    const parsed = parsePostImages(value).filter(part => part.type === 'image').map(part => part.value);
    return direct ? [direct] : parsed;
  }))];
}
