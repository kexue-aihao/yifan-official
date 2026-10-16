"use client";
import {useState, type FormEvent} from 'react';
import {imageSlots,siteImageURL} from '../../shared/media.mjs';
import {useCopy} from '../i18n';
import {useSite,send} from '../lib';
import {useMedia, type ImageMap} from '../MediaProvider';
import {ErrorNotice} from '../components';
const labels: Record<string,string> = {hero:'场景影像',wedding:'婚纱影像',story:'品牌故事',portrait:'个人写真',celebration:'庆典布置',dress:'礼服',beauty:'化妆造型',cosplay:'角色写真'};
export default function MediaSettings() {
  const copy = useCopy();
  const {images} = useMedia();
  const {refreshSite} = useSite();
  const [values,setValues] = useState<ImageMap>({...images});
  const [error,setError] = useState(''), [saved,setSaved] = useState(false), [busy,setBusy] = useState(false);
  async function save(event:FormEvent) {
    event.preventDefault(); setBusy(true);setSaved(false);setError('');
    try {
      const next = Object.fromEntries(Object.entries(values).map(([slot,value]) => [slot,(value || '').trim()]).filter(([,value]) => value));
      if (Object.values(next).some(value => !siteImageURL(value))) throw new Error('请输入有效的 HTTPS 图片链接');
      await send('/admin/settings/media',{images:next},'PUT'); await refreshSite();setSaved(true);
    } catch (error) {setError((error as Error).message);} finally {setBusy(false);}
  }
  return <form className="form media-settings" onSubmit={save}>
    <p>{copy('替换站点示例图片，应用于所有主题、作品和默认服务配图。留空恢复示例。')}</p>
    <p className="subtle-note">{copy('请使用有权展示的 HTTPS 图片直链。图片由访客浏览器直接加载。')}</p>
    <div className="media-settings-grid">{imageSlots.map(slot => <article key={slot}>
      <img src={siteImageURL(values[slot]) || `/images/${slot}.jpg`} alt={copy(labels[slot])} referrerPolicy="no-referrer" />
      <label>{copy(labels[slot])}<input type="url" value={values[slot] || ''} onChange={event => {setValues({...values,[slot]:event.target.value});setSaved(false);}} placeholder="https://…" maxLength={2048} /></label>
      <button className="text-button" type="button" onClick={() => {setValues({...values,[slot]:''});setSaved(false);}}>{copy('恢复示例图片')}</button>
    </article>)}</div>
    <ErrorNotice error={error}/>{saved && <p role="status" className="success-notice">{copy('站点图片已更新')}</p>}
    <button className="button" disabled={busy}>{copy(busy?'保存中…':'保存站点图片')}</button>
  </form>;
}
