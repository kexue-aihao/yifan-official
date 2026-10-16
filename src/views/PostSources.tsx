"use client";
import {useState,type FormEvent} from 'react';
import {useResource} from '../lib';
import {useCopy,useFormatting} from '../i18n';
import {Empty,ErrorNotice,Loading} from '../components';
type Source = {post_id:string;user_id:string;author:string;title:string|null;deleted:number;ip:string;fingerprint:string;fingerprint_version:string;fingerprint_quality:string;browser_signals:Record<string,string|number>|null;user_agent:string;accept_language:string;client_hints:string;content_hash:string;created_at:number;location:{country:string;region:string;city:string;geo_status:string}};
export function PostSourceDetails({postId,label='发布来源追溯'}:{postId?:string;label?:string}) {
  const copy=useCopy();
  const [opened,setOpened]=useState(false);
  return <details className="post-trace" onToggle={event=>setOpened(event.currentTarget.open)}><summary>{copy(label)}</summary>{opened && <PostSources postId={postId}/>}</details>;
}
export default function PostSources({postId}: {postId?:string}) {
  const copy = useCopy(),{dateTime} = useFormatting();
  const [search,setSearch]=useState(''),[query,setQuery]=useState(''),[page,setPage]=useState(1);
  const resource = useResource<{items:Source[];total:number}>(`/admin/post-sources?page=${page}&search=${encodeURIComponent(query)}${postId?`&postId=${postId}`:''}`);
  function filter(event:FormEvent) {event.preventDefault();setQuery(search.trim());setPage(1);}
  return <div className="post-source-panel">
    <p className="subtle-note">{copy('发布来源保留 180 天，完整 IP 和指纹仅管理员可见。浏览器信号可变更或伪造，仅供辅助关联。')}</p>
    {!postId && <form className="form source-search" onSubmit={filter}><label>{copy('帖子 ID / 注册 ID / IP / 指纹')}<input value={search} onChange={event=>setSearch(event.target.value)} maxLength={160}/></label><button className="button small">{copy('搜索')}</button></form>}
    <ErrorNotice error={resource.error}/>{resource.loading?<Loading/>:!resource.data?.items.length?<Empty title={copy('暂无来源记录，历史帖子不会补填。')}/>:resource.data.items.map(source=><article className="post-source" key={source.post_id}>
      <h3>{source.title || copy('帖子已删除')}</h3><time>{dateTime(source.created_at)}</time>
      <dl>
        <dt>{copy('帖子 ID')}</dt><dd><code>{source.post_id}</code></dd>
        <dt>{copy('注册 ID')}</dt><dd><code>{source.user_id}</code> · {source.author}</dd>
        <dt>{copy('发布 IP')}</dt><dd><code>{source.ip}</code> · {source.location.geo_status==='private'?copy('内网 / 本机'):source.location.geo_status==='unknown'?copy('归属地未知'):[source.location.country,source.location.region,source.location.city].filter(Boolean).join(' / ') || copy('归属地未知')}</dd>
        <dt>{copy('指纹摘要')}</dt><dd><code>{source.fingerprint}</code><small>{source.fingerprint_version} · {source.fingerprint_quality}</small></dd>
        <dt>User-Agent</dt><dd>{source.user_agent || '—'}</dd>
        <dt>Accept-Language / Client Hints</dt><dd>{source.accept_language} / {source.client_hints || '—'}</dd>
        <dt>{copy('浏览器信号')}</dt><dd><code>{source.browser_signals?JSON.stringify(source.browser_signals):copy('未提供')}</code></dd>
        <dt>{copy('内容摘要')}</dt><dd><code>{source.content_hash}</code></dd>
      </dl>
    </article>)}
    {!postId && !!resource.data && resource.data.total>25 && <div className="pagination"><button className="text-button" disabled={page===1} onClick={()=>setPage(page-1)}>{copy('上一页')}</button><span>{page} / {Math.ceil(resource.data.total/25)}</span><button className="text-button" disabled={page*25>=resource.data.total} onClick={()=>setPage(page+1)}>{copy('下一页')}</button></div>}
  </div>;
}
