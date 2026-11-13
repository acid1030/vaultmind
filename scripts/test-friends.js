const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const initSqlJs=require('sql.js');
const {migrateSchema}=require('../src/core/schema');
const {createFriendService}=require('../src/core/friends');
const {createChatService}=require('../src/core/chat');
const groups=require('../src/core/groups');
const gc=require('../src/core/group-crypto');
async function main(){
 const SQL=await initSqlJs(), files=new Map();
 const transport={list:async folder=>[...files.values()].filter(f=>f.folder===folder),upload:async(folder,name,bytes)=>{const token=crypto.randomUUID();files.set(token,{token,name,bytes,folder});return {file_token:token}},download:async token=>files.get(token).bytes};
 function device(email){
  const db=new SQL.Database();db.run('CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT,username TEXT,password_salt TEXT,password_hash TEXT);CREATE TABLE app_state(key TEXT PRIMARY KEY,value TEXT);CREATE TABLE library_items(scope TEXT,group_id TEXT);CREATE TABLE project_accounts(scope TEXT,group_id TEXT);');migrateSchema(db);migrateSchema(db);
  const all=(sql,args=[])=>{const stmt=db.prepare(sql);try{stmt.bind(args);const out=[];while(stmt.step())out.push(stmt.getAsObject());return out}finally{stmt.free()}};
  const one=(sql,args)=>all(sql,args)[0],user={id:crypto.randomUUID(),email,username:email.split('@')[0],password_salt:crypto.randomBytes(16).toString('base64'),password_hash:''};db.run('INSERT INTO users(id,email,username,password_salt,password_hash) VALUES(?,?,?,?,?)',Object.values(user));
  const session={user,password:'test-only-local',vaultId:crypto.randomUUID(),deviceId:crypto.randomUUID(),linked:true};
  const deps={db,queryOne:one,queryAll:all,save:()=>{},getSession:()=>session};
  return {...deps,one,user,friends:createFriendService(deps),chat:createChatService({...deps,getSettings:()=>({}),resolvePersonalFolder:async f=>f,transport})};
 }
 const a=device('a@example.com'),b=device('b@example.com'),c=device('c@example.com');
 assert.throws(()=>a.friends.invite({email:'a@example.com',folderToken:'private-folder'}),/自己/);
 assert.throws(()=>a.friends.invite({email:'b@example.com',folderToken:'root'}),/Token/);
 const invite=a.friends.invite({email:'b@example.com',folderToken:'private-folder'}),room={scope:'group',groupId:invite.groupId};
 assert.equal(a.friends.list()[0].status,'pending');
 assert.throws(()=>a.chat.send({...room,text:'too soon'}),/确认/);
 assert.throws(()=>c.friends.inspect({code:invite.code}),/其他账号/);
 assert.throws(()=>b.friends.accept({code:invite.code+'bad'}),/无效/);
 const reissued=a.friends.invite({email:'b@example.com',folderToken:'private-folder'});assert.equal(reissued.groupId,invite.groupId);
 assert.equal(b.friends.inspect({code:invite.code}).email,'a@example.com');
 const accepted=b.friends.accept({code:invite.code});assert.equal(b.friends.list()[0].status,'accepted');
 assert.equal(b.friends.list().length,1);b.friends.accept({code:invite.code});assert.equal(b.friends.list().length,1);
 assert.throws(()=>c.friends.accept({code:accepted.code}),/其他账号/);
 a.friends.accept({code:accepted.code});a.friends.accept({code:accepted.code});assert.equal(a.friends.list().length,1);
 assert.throws(()=>a.friends.invite({email:'b@example.com',folderToken:'private-folder'}),/已是好友/);
 assert.throws(()=>groups.inviteToGroup(a.db,()=>{},a.one,a.queryAll,a.user,'test-only-local',{groupId:room.groupId,email:'c@example.com'}),/群管理/);
 const body='private friend message';a.chat.send({...room,text:body});await a.chat.syncRoom(room);await b.chat.syncRoom(room);assert.equal(b.chat.list(room).messages[0].text,body);
 b.chat.send({...room,text:'reply'});await b.chat.syncRoom(room);await a.chat.syncRoom(room);assert.equal(a.chat.list(room).messages.length,2);
 const attachments=a.chat.stageAttachments({...room,files:[{name:'friend.txt',bytes:Buffer.from('friend attachment')}]});
 // Attachment staging may return its asynchronous result separately.
 const draft=await attachments;a.chat.send({...room,text:'file',attachmentIds:draft.map(f=>f.id)});await a.chat.syncRoom(room);await b.chat.syncRoom(room);
 const message=b.chat.list(room).messages.find(m=>m.text==='file');const file=await b.chat.getAttachment({...room,messageId:message.id,attachmentId:message.attachments[0].id});assert.equal(file.bytes.toString(),'friend attachment');
 a.friends.update({groupId:room.groupId,remark:'My friend'});assert.equal(a.friends.list()[0].remark,'My friend');
 const [prefix,encoded,key]=invite.code.split('.');const value=JSON.parse(gc.decryptWithGroupKey(JSON.parse(Buffer.from(encoded,'base64url').toString()),Buffer.from(key,'base64url')).toString());value.expiresAt='2000-01-01T00:00:00.000Z';const expired=`${prefix}.${Buffer.from(JSON.stringify(gc.encryptWithGroupKey(Buffer.from(JSON.stringify(value)),Buffer.from(key,'base64url')))).toString('base64url')}.${key}`;assert.throws(()=>b.friends.accept({code:expired}),/过期/);
 const restored=device('a@example.com');const restore=a.friends.exportDevice({groupId:room.groupId});assert.throws(()=>c.friends.accept(restore),/其他账号/);restored.friends.accept(restore);await restored.chat.syncRoom(room);assert.equal(restored.chat.list(room).messages.length,3);restored.db.close();
 a.friends.update({groupId:room.groupId,remove:true});assert.equal(a.friends.list().length,0);assert.throws(()=>a.chat.send({...room,text:'removed'}),/移除/);assert.throws(()=>a.chat.list(room),/移除/);
 assert.equal(a.db.export().includes(Buffer.from(body)),false,'message bodies are encrypted at rest');
 for(const d of [a,b,c])d.db.close();console.log('Friends: two-profile confirmation, isolation, encrypted text/file cloud roundtrip, remarks, deletion, expiry and replay passed.');
}
main().catch(e=>{console.error(e);process.exitCode=1});
