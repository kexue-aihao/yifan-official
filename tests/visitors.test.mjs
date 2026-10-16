import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {createApp} from '../server/app.mjs';
import {maintenance,migrateVisitors} from '../server/db.mjs';
import express from 'express';
import {configureProxy,getClientIP,locateIP,normalizeIP} from '../server/visitors.mjs';
import {createTestDatabase} from './mysql-fixture.mjs';
import {createVault} from '../server/security.mjs';

test('IP normalization and offline location classify IPv4, IPv6, private and invalid addresses',()=>{
  assert.equal(normalizeIP('::ffff:8.8.8.8'),'8.8.8.8');
  assert.equal(normalizeIP('2001:4860:4860:0000:0000:0000:0000:8888'),'2001:4860:4860::8888');
  assert.equal(normalizeIP('not-an-ip'),null);
  for(const ip of ['127.0.0.1','10.0.0.5','192.168.0.1','::1','fd00::1'])assert.equal(locateIP(ip).geo_status,'private');
  assert.equal(locateIP('8.8.8.8').country,'US');
  assert.equal(locateIP('2001:4860:4860::8888').country,'US');
});
test('Express proxy trust controls the real client IP from a live HTTP request', async (t) => {
  const app = express();
  configureProxy(app, '0');
  app.get('/ip', (req, res) => res.json({ ip: getClientIP(req) }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const request = (headers = {}) =>
    fetch(`${base}/ip`, { headers }).then((response) => response.json());

  assert.equal((await request()).ip, '127.0.0.1');
  // A direct client can send XFF, but it is not trusted when the app is in
  // direct mode. The loopback socket is the recorded address.
  assert.equal((await request({ 'x-forwarded-for': '8.8.8.8' })).ip, '127.0.0.1');

  configureProxy(app, '1');
  assert.equal((await request({ 'x-forwarded-for': '8.8.8.8' })).ip, '8.8.8.8');
  // With one trusted loopback proxy, the first untrusted address from the
  // right of a chain is the client address. A leftmost value is not blindly
  // accepted as the real client.
  assert.equal(
    (await request({ 'x-forwarded-for': '9.9.9.9, 8.8.8.8' })).ip,
    '8.8.8.8',
  );
  assert.equal(
    (await request({ 'x-forwarded-for': '::ffff:8.8.8.8' })).ip,
    '8.8.8.8',
  );
  assert.equal(
    (await request({ 'x-forwarded-for': '2001:4860:4860:0:0:0:0:8888' })).ip,
    '2001:4860:4860::8888',
  );
  // Alternate headers are never independently trusted, even in proxy mode.
  assert.equal((await request({
    'x-real-ip': '8.8.8.8',
    'cf-connecting-ip': '9.9.9.9',
    forwarded: 'for=1.1.1.1',
  })).ip, '127.0.0.1');

  // A configured proxy elsewhere does not authorize this loopback caller.
  configureProxy(app, '10.20.0.5/32');
  assert.equal((await request({ 'x-forwarded-for': '8.8.8.8' })).ip, '127.0.0.1');

  // Walk a multi-proxy chain from the socket, stopping at the first
  // untrusted address even if the client supplied earlier values.
  configureProxy(app, '127.0.0.1/32, ::1/128, 10.20.0.5/32');
  assert.equal(
    (await request({ 'x-forwarded-for': '9.9.9.9, 8.8.8.8, 10.20.0.5' })).ip,
    '8.8.8.8',
  );
  assert.equal(
    (await request({ 'x-forwarded-for': '9.9.9.9, 10.20.0.6' })).ip,
    '10.20.0.6',
  );
  // A broken trusted proxy header must not write arbitrary text as an IP.
  assert.equal((await request({ 'x-forwarded-for': 'not-an-ip' })).ip, '127.0.0.1');
});
test('Visitor audit: verified identity, trusted proxies, exact counts, booking/chat links, admin access and 180-day retention',async t=>{
  process.env.SETTINGS_ENCRYPTION_KEY=randomBytes(32).toString('hex');
  const fixture=await createTestDatabase();const db=fixture.db;
  const instance=await createApp({db,vault:createVault(),origin:'http://visitors.test',testing:true});
  const app=instance.app;configureProxy(app,'0');
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  const base=`http://127.0.0.1:${server.address().port}/api`;
  t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));await instance.close();await fixture.cleanup();});
  function client(){return {cookie:'',csrf:'',user:null,async req(path,method='GET',body,headers={}){
    const res=await fetch(base+path,{method,headers:{origin:'http://visitors.test','content-type':'application/json',cookie:this.cookie,'x-csrf-token':this.csrf,...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const value=await res.json();if(res.headers.getSetCookie()[0])this.cookie=res.headers.getSetCookie()[0].split(';')[0];if(value.csrf)this.csrf=value.csrf;if(value.user)this.user=value.user;return {status:res.status,data:value};
  }}}
  const guest=client(),alice=client(),admin=client();
  const register=async(c,name)=>{const result=await c.req('/auth/register','POST',{name,email:`${name}@test.example`,password:'VisitorTest123!',consent:true});assert.equal(result.status,201);};
  await register(alice,'alice');await register(admin,'admin');await db.prepare("UPDATE users SET role='admin' WHERE id=?").run(admin.user.id);
  assert.equal((await guest.req('/admin/visitors')).status,401);assert.equal((await alice.req('/admin/visitor-events')).status,403);
  const eventId=randomUUID();const fake={'x-forwarded-for':'8.8.8.8'};
  assert.equal((await alice.req('/visits','POST',{eventId,path:'/services',userId:admin.user.id,ip:'8.8.8.8'},fake)).status,202);
  await alice.req('/visits','POST',{eventId,path:'/services'},fake);
  const first=await db.prepare('SELECT * FROM visitor_events WHERE id=?').get(eventId);
  assert.equal(first.ip,'127.0.0.1');assert.equal(first.user_id,alice.user.id);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM visitor_events WHERE id=?').get(eventId)).n,1);
  assert.equal((await alice.req('/visits','POST',{eventId:randomUUID(),path:'/account?email=private'})).status,400);
  configureProxy(app,'1');
  const forwarded={'x-forwarded-for':'9.9.9.9, 8.8.8.8'};
  await alice.req('/visits','POST',{eventId:randomUUID(),path:'/portfolio'},forwarded);
  await alice.req('/visits','POST',{eventId:randomUUID(),path:'/'},{'x-forwarded-for':'::ffff:8.8.8.8'});
  const geo=await db.prepare('SELECT * FROM visitor_ips WHERE ip=?').get('8.8.8.8');assert.equal(geo.country,'US');
  const day=new Date(Date.now()+8*3600000+86400000).toISOString().slice(0,10);
  const input={serviceId:'bridal',day,time:'10:00',contactName:'Alice',phone:'13800000000',note:'Test',requestKey:randomUUID()};
  const booking=await alice.req('/bookings','POST',input,forwarded);assert.equal(booking.status,201);
  const retry=await alice.req('/bookings','POST',input,forwarded);assert.equal(retry.data.id,booking.data.id);
  const thread=(await alice.req('/conversations','POST',{bookingId:booking.data.id},forwarded)).data;
  const message=await alice.req(`/conversations/${thread.id}/messages`,'POST',{body:'Hello'},forwarded);assert.equal(message.status,201);
  const history=(await admin.req(`/admin/visitor-events?bookingId=${booking.data.id}`)).data;
  assert.equal(history.total,3);assert.ok(history.items.every(e=>e.user_id===alice.user.id&&e.ip==='8.8.8.8'&&e.conversation_id===thread.id));
  assert.equal(history.items.find(e=>e.kind==='message').message_id,message.data.id);
  const metrics=(await admin.req('/admin/visitors?search=8.8.8.8')).data;
  assert.equal(metrics.totals.ips,1);const ip=metrics.items[0];
  assert.equal(Number(ip.page_count),2);assert.equal(Number(ip.booking_count),1);assert.equal(Number(ip.message_count),1);assert.equal(ip.occurrence_count,5);assert.equal(ip.user_count,1);
  assert.equal((await db.prepare('SELECT resolved_at FROM visitor_ips WHERE ip=?').get('8.8.8.8')).resolved_at,geo.resolved_at);
  const filter=(await admin.req(`/admin/visitors?search=${alice.user.id}`)).data;assert.equal(filter.totals.ips,2);
  await guest.req('/visits','POST',{eventId:randomUUID(),path:'/'},{'x-forwarded-for':'2001:4860:4860::8888'});
  assert.equal((await admin.req('/admin/visitors?search=2001%3A4860%3A4860%3A%3A8888')).data.items[0].country,'US');
  await migrateVisitors(db);assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM bookings').get()).n,1);
  await db.prepare('UPDATE visitor_events SET created_at=? WHERE id=?').run(Date.now()-181*86400000,eventId);
  assert.equal((await admin.req(`/admin/visitor-events?ip=127.0.0.1&userId=${alice.user.id}`)).data.total,1); // registration remains
  await maintenance(db);assert.equal(await db.prepare('SELECT id FROM visitor_events WHERE id=?').get(eventId),undefined);
  assert.equal((await alice.req('/admin/visitor-events?ip=8.8.8.8')).status,403);
});
