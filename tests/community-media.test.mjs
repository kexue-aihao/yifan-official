import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {imageURL,siteImageURL,parsePostImages,parseImageLinks} from '../shared/media.mjs';
import {createTestDatabase} from './mysql-fixture.mjs';
import {createApp} from '../server/app.mjs';
import {maintenance,migrateCommunity} from '../server/db.mjs';
import {configureProxy} from '../server/visitors.mjs';
import {createVault} from '../server/security.mjs';

test('Community image parsing preserves text and rejects active content and local targets', () => {
  const urls=['https://cdn.example.com/a.jpg?token=abc','https://cdn.example.com/b.webp','https://cdn.example.com/c.png','https://cdn.example.com/signed?id=123'];
  const body='文字 ![婚纱]('+urls[0]+')\n[img]'+urls[1]+'[/img]\n'+urls[2]+'。';
  const parts=parsePostImages(body);
  assert.deepEqual(parts.filter(p=>p.type==='image').map(p=>p.value),urls.slice(0,3));
  assert.equal(parts.find(p=>p.type==='image').alt,'婚纱');
  assert.ok(parts.some(p=>p.type==='text'&&p.value.includes('文字')));
  assert.equal(parts.at(-1).value,'。');
  assert.deepEqual(parseImageLinks([urls[0],urls[0],'[img]'+urls[1]+'[/img]',urls[3]]),[urls[0],urls[1],urls[3]]);
  assert.equal(siteImageURL('/images/wedding.jpg'),'/images/wedding.jpg');
  assert.equal(siteImageURL('/data/installation.json'),null);
  for(const url of ['javascript:alert(1)','data:image/svg+xml,test','http://cdn.example.com/a.jpg','https://localhost/a.jpg','https://localhost./a.jpg','https://127.0.0.1/a.jpg','https://2130706433/a.jpg','https://10.1.2.3/a.jpg','https://[::1]/a.jpg','https://[::ffff:127.0.0.1]/a.jpg','https://192.168.1.1/a.jpg','https://cdn.example.com:444/a.jpg','https://user:pass@cdn.example.com/a.jpg','https://cdn.example.com/x.svg','https://cdn.example.com/a.html','https://cdn.example.com/a.jpg#x','https://cdn.example.com/a.jpg" onerror="alert(1)']) assert.equal(imageURL(url),null,url);
  assert.equal(parsePostImages('<script>alert(1)</script> ![x](javascript:alert(1)) [img]data:test[/img]').filter(p=>p.type==='image').length,0);
});

test('Post media and publication sources: atomic identity, permissions, retention and upgrade', async t => {
  process.env.SETTINGS_ENCRYPTION_KEY=randomBytes(32).toString('hex');
  const fixture=await createTestDatabase();
  const db=fixture.db,vault=createVault(),origin='http://community.test';
  const runtime=await createApp({db,vault,origin,testing:true});
  configureProxy(runtime.app,'0');
  const server=runtime.app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await runtime.close();await fixture.cleanup();});
  const base='http://127.0.0.1:'+server.address().port+'/api';
  function client(){return {cookie:'',csrf:'',user:null,async req(path,method='GET',body,headers={}){
    const response=await fetch(base+path,{method,headers:{origin,'content-type':'application/json',cookie:this.cookie,'x-csrf-token':this.csrf,...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const data=await response.json();if(data.csrf)this.csrf=data.csrf;if(data.user)this.user=data.user;
    const cookie=response.headers.getSetCookie()[0];if(cookie)this.cookie=cookie.split(';')[0];
    return {status:response.status,data};
  }};}
  const guest=client(),alice=client(),admin=client();
  for(const [c,name] of [[alice,'alice'],[admin,'admin']]) assert.equal((await c.req('/auth/register','POST',{name,email:name+'@community.example',password:'CommunityTest123!',consent:true})).status,201);
  await db.prepare("UPDATE users SET role='admin' WHERE id=?").run(admin.user.id);
  const images=['https://cdn.example.com/wedding.jpg?key=xyz','[img]https://cdn.example.com/portrait.webp[/img]'];
  const signals={language:'zh-CN',timezone:'Asia/Shanghai',platform:'Win32',screen:'1920x1080x24',pixelRatio:1,concurrency:8};
  const post={title:'图床与来源测试',body:'正文内容，含 ![礼服](https://cdn.example.com/dress.png)',category:'拍摄日记',images,browserSignals:signals,user_id:admin.user.id,ip:'8.8.8.8',fingerprint:'forged'};
  const headers={'user-agent':'Community Browser/1.0','accept-language':'zh-CN','sec-ch-ua':'Test/1'};
  let postId,source;
  await t.test('Publication records authenticated identity and server IP, never body-supplied claims',async()=>{
    assert.equal((await guest.req('/posts','POST',post)).status,401);
    assert.equal((await alice.req('/posts','POST',post,{'x-csrf-token':'wrong'})).status,403);
    const result=await alice.req('/posts','POST',post,headers);assert.equal(result.status,201);postId=result.data.id;
    source=await db.prepare('SELECT * FROM post_sources WHERE post_id=?').get(postId);
    assert.equal(source.user_id,alice.user.id);assert.equal(source.ip,'127.0.0.1');
    assert.match(source.fingerprint,/^[a-f0-9]{64}$/);assert.equal(source.fingerprint_version,'v1-hmac-sha256');
    assert.equal(source.fingerprint_quality,'browser-reported');assert.deepEqual(JSON.parse(source.browser_signals),signals);
    assert.equal(source.user_agent,headers['user-agent']);assert.match(source.content_hash,/^[a-f0-9]{64}$/);
    const second=await alice.req('/posts','POST',post,headers);
    assert.equal((await db.prepare('SELECT fingerprint FROM post_sources WHERE post_id=?').get(second.data.id)).fingerprint,source.fingerprint);
    assert.notEqual(vault.fingerprint('x'),createVault().fingerprint('y'));
  });
  await t.test('Public feeds, details and administrator post list never expose source records',async()=>{
    for(const response of [await guest.req('/posts'),await guest.req('/posts/'+postId),await alice.req('/posts/'+postId),await admin.req('/admin/posts')]) {
      assert.equal(response.status,200);
      const json=JSON.stringify(response.data);assert.ok(!json.includes('fingerprint'));assert.ok(!json.includes(source.ip));assert.ok(!json.includes('browser_signals'));
    }
    const detail=(await guest.req('/posts/'+postId)).data;
    assert.equal(detail.user_id,alice.user.id);assert.deepEqual(detail.images,['https://cdn.example.com/wedding.jpg?key=xyz','https://cdn.example.com/portrait.webp']);
    assert.equal((await guest.req('/admin/post-sources')).status,401);assert.equal((await alice.req('/admin/post-sources?postId='+postId)).status,403);
    const trace=(await admin.req('/admin/post-sources?postId='+postId)).data;assert.equal(trace.total,1);assert.equal(trace.items[0].ip,source.ip);
    for(const search of [postId,alice.user.id,source.ip,source.fingerprint]) assert.ok((await admin.req('/admin/post-sources?search='+search)).data.total>=1);
    assert.equal((await admin.req('/admin/post-sources?postId=invalid')).status,400);
  });
  await t.test('Link validation, limits, spoof resistance and transactional source creation',async()=>{
    const before=(await db.prepare('SELECT COUNT(*) AS n FROM posts').get()).n;
    for(const invalid of [{images:['javascript:alert(1)']},{images:['https://127.0.0.1/a.jpg']},{images:Array.from({length:10},(_,i)=>'https://cdn.example.com/'+i+'.jpg')},{browserSignals:{...signals,screen:'invalid'}},{body:Array.from({length:10},(_,i)=>'https://cdn.example.com/'+i+'.jpg').join('\n')}]) assert.equal((await alice.req('/posts','POST',{...post,...invalid})).status,400);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM posts').get()).n,before);
    configureProxy(runtime.app,'1');
    const result=await alice.req('/posts','POST',{title:'可信代理来源',body:'服务端记录代理链来源',category:'交流问答'}, {'x-forwarded-for':'9.9.9.9, 8.8.8.8'});
    const forwarded=await db.prepare('SELECT * FROM post_sources WHERE post_id=?').get(result.data.id);
    assert.equal(forwarded.ip,'8.8.8.8');assert.equal(forwarded.fingerprint_quality,'request-only');assert.equal(JSON.parse(forwarded.location).country,'US');
    const failingDb={...db,close:async()=>{},prepare(sql){if(sql.startsWith('INSERT INTO post_sources'))return {run:async()=>{throw new Error('Simulated source failure');}};return db.prepare(sql);}};
    const failing=await createApp({db:failingDb,vault,origin,testing:true});
    const failServer=failing.app.listen(0,'127.0.0.1');await new Promise(resolve=>failServer.once('listening',resolve));
    try {
      const res=await fetch('http://127.0.0.1:'+failServer.address().port+'/api/posts',{method:'POST',headers:{origin,'content-type':'application/json',cookie:alice.cookie,'x-csrf-token':alice.csrf},body:JSON.stringify({...post,title:'Should roll back'})});
      assert.equal(res.status,500);assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM posts WHERE title='Should roll back'").get()).n,0);
    } finally {failServer.closeAllConnections();await new Promise(resolve=>failServer.close(resolve));await failing.close();}
  });
  await t.test('Only administrators can replace images, custom service links survive upgrade',async()=>{
    const config={images:{wedding:'https://cdn.example.com/new-wedding.webp',dress:'https://cdn.example.com/dress.png'}};
    assert.equal((await alice.req('/admin/settings/media','PUT',config)).status,403);
    assert.equal((await admin.req('/admin/settings/media','PUT',config,{origin:'http://wrong.example'})).status,403);
    for(const images of [{unknown:'https://cdn.example.com/a.jpg'},{wedding:'javascript:alert(1)'},{wedding:'https://192.168.0.1/a.jpg'}]) assert.equal((await admin.req('/admin/settings/media','PUT',{images})).status,400);
    assert.equal((await admin.req('/admin/settings/media','PUT',config)).status,200);
    assert.deepEqual((await guest.req('/settings')).data.media,config);
    const service=(await admin.req('/admin/services')).data[0];service.image='https://cdn.example.com/custom.jpg';
    assert.equal((await admin.req('/admin/services/'+service.id,'PUT',service)).status,200);
    await migrateCommunity(db);assert.deepEqual((await guest.req('/settings')).data.media,config);
    assert.equal((await guest.req('/services')).data.find(item=>item.id===service.id).image,service.image);
    assert.equal((await admin.req('/admin/settings/media','PUT',{images:{}})).status,200);assert.deepEqual((await guest.req('/settings')).data.media,{images:{}});
  });
  await t.test('Deletion preserves a 180-day source record; expired sources are filtered and removed',async()=>{
    assert.equal((await alice.req('/posts/'+postId,'DELETE',{})).status,200);
    assert.equal((await guest.req('/posts/'+postId)).status,404);
    assert.equal(await db.prepare('SELECT * FROM post_media WHERE post_id=?').get(postId),undefined);
    const deleted=(await admin.req('/admin/post-sources?postId='+postId)).data.items[0];assert.equal(deleted.deleted,1);assert.equal(deleted.user_id,alice.user.id);
    await db.prepare('UPDATE post_sources SET created_at=? WHERE post_id=?').run(Date.now()-181*86400000,postId);
    assert.equal((await admin.req('/admin/post-sources?postId='+postId)).data.total,0);
    await maintenance(db);assert.equal(await db.prepare('SELECT * FROM post_sources WHERE post_id=?').get(postId),undefined);
    const legacy=randomUUID();await db.prepare('INSERT INTO posts(id,user_id,title,body,category,created_at) VALUES (?,?,?,?,?,?)').run(legacy,alice.user.id,'旧帖子','历史内容保留','交流问答',Date.now());
    await migrateCommunity(db);assert.deepEqual((await guest.req('/posts/'+legacy)).data.images,[]);assert.equal((await admin.req('/admin/post-sources?postId='+legacy)).data.total,0);
  });
});
