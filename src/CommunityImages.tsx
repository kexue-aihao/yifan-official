"use client";
import {useState} from 'react';
import {parsePostImages} from '../shared/media.mjs';
import {useCopy} from './i18n';
export function CommunityImage({url,alt=''}: {url:string;alt?:string}) {
  const copy = useCopy();
  const [failed,setFailed] = useState(false);
  return <figure className="community-image">{failed
    ? <a href={url} target="_blank" rel="noopener noreferrer nofollow ugc">{copy('图片未能加载，打开原图')}</a>
    : <a href={url} target="_blank" rel="noopener noreferrer nofollow ugc"><img src={url} alt={alt || copy('社区图片')} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} /></a>
  }</figure>;
}
export function PostContent({body,images=[]}: {body:string;images?:string[]}) {
  return <div className="post-content">{parsePostImages(body).map((part,index) => part.type === 'image'
    ? <CommunityImage key={index} url={part.value} alt={part.alt} />
    : <span key={index}>{part.value}</span>)}
    {!!images.length && <div className="post-image-grid">{images.map(url => <CommunityImage key={url} url={url} />)}</div>}
  </div>;
}
export function PostSummary({body,images=[]}: {body:string;images?:string[]}) {
  const copy = useCopy();
  const parts = parsePostImages(body);
  const text = parts.filter(part=>part.type==='text').map(part=>part.value).join('').trim();
  const previews = [...new Set([...parts.filter(part=>part.type==='image').map(part=>part.value),...images])].slice(0,3);
  return <><p>{text.slice(0,180)}{text.length>180?'…':''}</p>{!!previews.length && <div className="post-thumbnails">{previews.map(url=><img key={url} src={url} alt={copy('社区图片')} loading="lazy" referrerPolicy="no-referrer" onError={event=>{event.currentTarget.style.display='none';}} />)}</div>}</>;
}
export function browserSignals() {
  let timezone = '';
  try {timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;} catch { /* Unavailable browser signal. */ }
  return {language: navigator.language.slice(0,50), timezone: timezone.slice(0,100),
    platform: navigator.platform.slice(0,100), screen: `${screen.width}x${screen.height}x${screen.colorDepth}`,
    pixelRatio: Math.min(20,window.devicePixelRatio || 1), concurrency: Math.min(1024,navigator.hardwareConcurrency || 0)};
}
