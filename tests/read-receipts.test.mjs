import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {createTestDatabase} from './mysql-fixture.mjs';
import {createApp} from '../server/app.mjs';
import {hashPassword,createVault} from '../server/security.mjs';
import {migrateReadReceipts,maintenance} from '../server/db.mjs';

test('工作人员查看预约与消息已读：权限、可见范围、回执、升级及持久化', async t => {
  process.env.SETTINGS_ENCRYPTION_KEY=randomBytes(32).toString('hex');
  const fixture=await createTestDatabase();
  const {db}=fixture;
  const origin='http://receipts.yifan.test';
  const app=await createApp({db,origin,vault:createVault(),testing:true});
  const server=app.app.listen(0,'127.0.0.1');
  await new Promise(r=>server.once('listening',r));
  const base='http://127.0.0.1:'+server.address().port+'/api';
  t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));await app.close();await fixture.cleanup();});
  class Client {
    cookie='';csrf='';user;
    async req(path,method='GET',body,extra={}){
      const response=await fetch(base+path,{method,headers:{origin,'content-type':'application/json',cookie:this.cookie,'x-csrf-token':this.csrf,...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});
      const cookie=response.headers.getSetCookie()[0];if(cookie)this.cookie=cookie.split(';')[0];
      const data=await response.json();if(data.csrf)this.csrf=data.csrf;if(data.user)this.user=data.user;
      return {status:response.status,data};
    }
  }
  const anonymous=new Client(),customer=new Client(),other=new Client(),staff=new Client(),secondStaff=new Client();
  for(const [client,email] of [[customer,'receipt-customer@example.com'],[other,'receipt-other@example.com']])
    assert.equal((await client.req('/auth/register','POST',{name:'测试顾客',email,password:'ReceiptCustomer123!',consent:true})).status,201);
  for(const [client,email] of [[staff,'receipt-staff@example.com'],[secondStaff,'receipt-staff2@example.com']]){
    await db.prepare('INSERT INTO users VALUES (?,?,?,?,?,?)').run(randomUUID(),email,'测试员工',await hashPassword('ReceiptStaff123!'),'admin',Date.now());
    assert.equal((await client.req('/auth/login','POST',{email,password:'ReceiptStaff123!'})).status,200);
  }
  const booking=(await customer.req('/bookings','POST',{
    serviceId:'bridal',day:new Date(Date.now()+8*3600000+86400000).toISOString().slice(0,10),
    time:'10:00',contactName:'测试顾客',phone:'13800000000',note:'已读回执测试',requestKey:randomUUID(),
  })).data;
  const thread=(await customer.req('/conversations','POST',{bookingId:booking.id})).data;
  const otherThread=(await other.req('/conversations','POST',{})).data;
  const ownMessage=(await customer.req('/conversations/'+thread.id+'/messages','POST',{body:'第一条待阅读消息'})).data.id;
  const unseenMessage=(await customer.req('/conversations/'+thread.id+'/messages','POST',{body:'尚未显示的消息'})).data.id;
  const foreignMessage=(await other.req('/conversations/'+otherThread.id+'/messages','POST',{body:'其他顾客的消息'})).data.id;
  const adminMessage=(await staff.req('/conversations/'+thread.id+'/messages','POST',{body:'工作人员发送的消息'})).data.id;
  let viewedAt,readAt;
  await t.test('仅拉取列表或消息不产生已读，既有数据升级不伪造回执',async()=>{
    await db.exec('DROP TABLE message_staff_reads');await db.exec('DROP TABLE booking_staff_views');
    await migrateReadReceipts(db);await migrateReadReceipts(db);
    const bookings=(await staff.req('/admin/bookings')).data;
    assert.equal(bookings.find(b=>b.id===booking.id).staff_viewed_at,null);
    const messages=(await staff.req('/conversations/'+thread.id+'/messages')).data;
    assert.equal(messages.length,3);assert(messages.every(m=>m.staff_read_at===null));
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM message_staff_reads').get()).n,0);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM booking_staff_views').get()).n,0);
  });
  await t.test('匿名与顾客不能冒充工作人员，写请求校验来源与 CSRF',async()=>{
    for(const [client,status] of [[anonymous,401],[customer,403],[other,403]]){
      assert.equal((await client.req('/admin/bookings/'+booking.id+'/view','POST',{})).status,status);
      assert.equal((await client.req('/conversations/'+thread.id+'/read','POST',{messageIds:[ownMessage]})).status,status);
    }
    assert.equal((await staff.req('/conversations/'+thread.id+'/read','POST',{messageIds:[ownMessage]},{'x-csrf-token':''})).status,403);
    assert.equal((await staff.req('/admin/bookings/'+booking.id+'/view','POST',{}, {origin:'http://wrong.test'})).status,403);
    assert.equal((await staff.req('/admin/bookings/'+randomUUID()+'/view','POST',{})).status,404);
  });
  await t.test('打开单笔预约后推送查看回执，首次时间及查看人不会被重复覆盖',async()=>{
    const abort=new AbortController();const timeout=setTimeout(()=>abort.abort(),10000);
    try{
      const stream=await fetch(base+'/events',{headers:{cookie:customer.cookie},signal:abort.signal});
      const reader=stream.body.getReader();await reader.read();
      const result=await staff.req('/admin/bookings/'+booking.id+'/view','POST',{});
      assert.equal(result.status,200);viewedAt=result.data.staff_viewed_at;assert(viewedAt>0);
      assert.match(new TextDecoder().decode((await reader.read()).value),/booking-viewed/);
      const again=await secondStaff.req('/admin/bookings/'+booking.id+'/view','POST',{});
      assert.equal(again.data.staff_viewed_at,viewedAt);
      const record=await db.prepare('SELECT * FROM booking_staff_views WHERE booking_id=?').get(booking.id);
      assert.equal(record.staff_id,staff.user.id);
      const customerView=(await customer.req('/bookings')).data.find(b=>b.id===booking.id);
      assert.equal(customerView.staff_viewed_at,viewedAt);assert.equal(customerView.status,'pending');
    }finally{clearTimeout(timeout);abort.abort();}
  });
  await t.test('仅确认实际提交的顾客消息，SSE 同步且新消息仍为未读',async()=>{
    const abort=new AbortController();const timeout=setTimeout(()=>abort.abort(),10000);
    try{
      const stream=await fetch(base+'/events',{headers:{cookie:customer.cookie},signal:abort.signal});
      const reader=stream.body.getReader();await reader.read();
      const result=await staff.req('/conversations/'+thread.id+'/read','POST',{messageIds:[ownMessage,ownMessage]});
      assert.equal(result.status,200);assert.equal(result.data.receipts.length,1);
      readAt=result.data.receipts[0].staff_read_at;assert(readAt>0);
      const event=new TextDecoder().decode((await reader.read()).value);
      assert.match(event,/messages-read/);assert(event.includes(ownMessage));
      const again=await secondStaff.req('/conversations/'+thread.id+'/read','POST',{messageIds:[ownMessage]});
      assert.equal(again.data.receipts[0].staff_read_at,readAt);
      const messages=(await customer.req('/conversations/'+thread.id+'/messages')).data;
      assert.equal(messages.find(m=>m.id===ownMessage).staff_read_at,readAt);
      assert.equal(messages.find(m=>m.id===unseenMessage).staff_read_at,null);
      assert.equal(messages.find(m=>m.id===adminMessage).staff_read_at,null);
      const fresh=(await customer.req('/conversations/'+thread.id+'/messages','POST',{body:'阅读之后的新消息'})).data.id;
      assert.equal((await customer.req('/conversations/'+thread.id+'/messages')).data.find(m=>m.id===fresh).staff_read_at,null);
    }finally{clearTimeout(timeout);abort.abort();}
  });
  await t.test('拒绝跨会话、工作人员自身、过期消息和无效批次，不产生部分已读',async()=>{
    const expired=randomUUID();
    await db.prepare('INSERT INTO messages(id,conversation_id,sender_id,body,created_at) VALUES (?,?,?,?,?)')
      .run(expired,thread.id,customer.user.id,'过期消息',Date.now()-181*86400000);
    for(const ids of [[unseenMessage,foreignMessage],[adminMessage],[expired],[randomUUID()]])
      assert.equal((await staff.req('/conversations/'+thread.id+'/read','POST',{messageIds:ids})).status,404);
    for(const ids of [[],['invalid'],Array.from({length:101},()=>randomUUID())])
      assert.equal((await staff.req('/conversations/'+thread.id+'/read','POST',{messageIds:ids})).status,400);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM message_staff_reads WHERE message_id=?').get(unseenMessage)).n,0);
  });
  await t.test('重新加载数据后保留回执，180 天清理同步移除消息回执',async()=>{
    await migrateReadReceipts(db);
    assert.equal((await customer.req('/bookings')).data.find(b=>b.id===booking.id).staff_viewed_at,viewedAt);
    assert.equal((await customer.req('/conversations/'+thread.id+'/messages')).data.find(m=>m.id===ownMessage).staff_read_at,readAt);
    await db.prepare('UPDATE messages SET created_at=? WHERE id=?').run(Date.now()-181*86400000,ownMessage);
    await maintenance(db);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM message_staff_reads WHERE message_id=?').get(ownMessage)).n,0);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM booking_staff_views WHERE booking_id=?').get(booking.id)).n,1);
  });
});
