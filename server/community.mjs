import {createHash} from 'node:crypto';
import {z} from 'zod';
import {getClientIP, locateIP, visitorCutoff} from './visitors.mjs';
import {imageURL, parseImageLinks, parsePostImages, MAX_POST_IMAGES} from '../shared/media.mjs';

export const browserSignalsSchema = z.object({
  language: z.string().max(50), timezone: z.string().max(100),
  platform: z.string().max(100), screen: z.string().regex(/^\d{1,5}x\d{1,5}x\d{1,3}$/),
  pixelRatio: z.number().finite().min(0).max(20),
  concurrency: z.number().int().min(0).max(1024),
}).strict();
export const postImagesSchema = z.array(z.string().trim().max(5000)).max(MAX_POST_IMAGES).default([])
  .transform((values, context) => {
    for (const value of values) {
      if (!imageURL(value) && !parsePostImages(value).some(part => part.type === 'image')) {
        context.addIssue({code: 'custom', message: '请输入有效的 HTTPS 图片链接'});
      }
    }
    const images = parseImageLinks(values);
    if (images.length > MAX_POST_IMAGES) context.addIssue({code: 'custom', message: '每篇帖子最多 9 张图片'});
    return images;
  });

export function publicationSource(req, input, vault) {
  const ip = getClientIP(req);
  if (!ip) throw new Error('Cannot determine publication IP');
  const userAgent = String(req.get('user-agent') || '').slice(0,1000);
  const acceptLanguage = String(req.get('accept-language') || '').slice(0,300);
  const clientHints = String(req.get('sec-ch-ua') || '').slice(0,500);
  const signals = input.browserSignals || null;
  const canonical = JSON.stringify([userAgent,acceptLanguage,clientHints,signals && [
    signals.language,signals.timezone,signals.platform,signals.screen,signals.pixelRatio,signals.concurrency,
  ]]);
  return {
    ip, fingerprint: vault.fingerprint(canonical), fingerprint_version: 'v1-hmac-sha256',
    fingerprint_quality: signals ? 'browser-reported' : 'request-only',
    browser_signals: JSON.stringify(signals), user_agent: userAgent, accept_language: acceptLanguage,
    client_hints: clientHints, location: JSON.stringify(locateIP(ip)),
    content_hash: createHash('sha256').update(JSON.stringify([input.title,input.body,input.category,input.images])).digest('hex'),
  };
}
export function postSourceRoutes(app, db) {
  app.get('/api/admin/post-sources', async (req,res) => {
    const page = z.coerce.number().int().min(1).max(10000).default(1).parse(req.query.page);
    const search = z.string().trim().max(160).default('').parse(req.query.search);
    const postId = z.uuid().optional().parse(req.query.postId);
    let where = ' WHERE s.created_at>?';
    const args = [visitorCutoff()];
    if (postId) { where += ' AND s.post_id=?'; args.push(postId); }
    if (search) { where += ' AND (s.post_id=? OR s.user_id=? OR s.ip=? OR s.fingerprint=?)'; args.push(search,search,search,search); }
    const {total} = await db.prepare(`SELECT COUNT(*) AS total FROM post_sources s${where}`).get(...args);
    const items = await db.prepare(`SELECT s.*,u.name AS author,p.title,p.hidden,(p.id IS NULL) AS deleted
      FROM post_sources s LEFT JOIN users u ON u.id=s.user_id LEFT JOIN posts p ON p.id=s.post_id
      ${where} ORDER BY s.created_at DESC,s.post_id LIMIT 25 OFFSET ?`).all(...args,(page-1)*25);
    res.json({items: items.map(item => ({...item, browser_signals: JSON.parse(item.browser_signals), location: JSON.parse(item.location)})),total,page,pageSize:25,retentionDays:180});
  });
}
