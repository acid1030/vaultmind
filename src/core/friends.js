const crypto = require('node:crypto');
const groups = require('./groups');
const gc = require('./group-crypto');
const ID = /^[a-f0-9-]{36}$/i;
const account = value => String(value || '').trim().toLowerCase();
function createFriendService({ db, queryOne, queryAll, save, getSession }) {
  function session() { const s = getSession(); if (!s?.user || !s.password) throw new Error('请先登录'); return s; }
  function list() { const s = session(); return queryAll(`SELECT c.group_id AS groupId, c.peer_email AS email, c.peer_name AS name, c.remark, c.status, g.feishu_folder_token AS folderToken FROM friend_contacts c JOIN groups g ON g.id=c.group_id WHERE c.user_id=? AND c.status!='deleted' ORDER BY c.created_at DESC`, [s.user.id]); }
  function seal(value) { const key = crypto.randomBytes(32); return `mizhanfriend1.${Buffer.from(JSON.stringify(gc.encryptWithGroupKey(Buffer.from(JSON.stringify(value)), key))).toString('base64url')}.${key.toString('base64url')}`; }
  function read(code) {
    try {
      if (typeof code !== 'string' || code.length > 16000) throw Error();
      const [prefix, body, secret, extra] = code.trim().split('.');
      if (prefix !== 'mizhanfriend1' || !body || !secret || extra || Buffer.from(secret,'base64url').length !== 32) throw Error();
      const v = JSON.parse(gc.decryptWithGroupKey(JSON.parse(Buffer.from(body,'base64url').toString()), Buffer.from(secret,'base64url')).toString());
      if (v.version !== 1 || !['request','accepted','device'].includes(v.kind) || !ID.test(v.id) || !ID.test(v.nonce) || !ID.test(v.ownerId) || typeof v.folder !== 'string' || !v.folder || v.folder === 'root' || v.folder.length > 1000 || typeof v.key !== 'string' || Buffer.from(v.key,'base64').length !== 32 || !Number.isFinite(Date.parse(v.expiresAt)) || typeof v.from !== 'string' || typeof v.to !== 'string' || v.from === v.to || v.from.length > 254 || v.to.length > 254 || !v.from || !v.to || typeof v.name !== 'string' || v.name.length > 100 || (v.peerName !== undefined && (typeof v.peerName !== 'string' || v.peerName.length > 100))) throw Error();
      if (v.kind === 'device' && ![v.from,v.to].includes(v.deviceEmail)) throw Error();
      if (Date.parse(v.expiresAt) <= Date.now()) throw Error('expired');
      return v;
    } catch (e) { throw Error(e.message === 'expired' ? '好友邀请已过期，请重新生成' : '好友邀请码无效或已损坏'); }
  }
  function put(v, s, status) {
    const from = account(s.user.email) === v.from;
    const other = from ? v.to : v.from;
    const existing = queryOne('SELECT * FROM friend_rooms WHERE group_id=?',[v.id]);
    if (existing && (existing.inviter_email !== v.from || existing.invitee_email !== v.to || existing.nonce !== v.nonce)) throw Error('邀请与已有私聊不一致');
    const group = queryOne('SELECT * FROM groups WHERE id=?',[v.id]);
    if (group && (!existing || group.feishu_folder_token !== v.folder || group.owner_user_id !== v.ownerId)) throw Error('邀请与已有会话冲突');
    if (queryOne('SELECT * FROM group_member_keys WHERE group_id=? AND user_id=?',[v.id,s.user.id])) {
      if (!groups.getGroupKeyForUser(db,queryOne,v.id,s.user.id,s.user,s.password).equals(Buffer.from(v.key,'base64'))) throw Error('私聊密钥不一致');
    }
    const wrapped = gc.wrapGroupKey(Buffer.from(v.key,'base64'), s.user,s.password);
    const now = new Date().toISOString();
    db.run('BEGIN');
    try {
      db.run('INSERT OR IGNORE INTO groups(id,name,slug,owner_user_id,feishu_folder_token,key_version,created_at) VALUES(?,?,?,?,?,1,?)',[v.id,'好友私聊',`friend-${v.id}`,v.ownerId,v.folder,now]);
      db.run('INSERT OR IGNORE INTO friend_rooms(group_id,inviter_email,invitee_email,nonce) VALUES(?,?,?,?)',[v.id,v.from,v.to,v.nonce]);
      db.run("INSERT OR REPLACE INTO group_memberships(group_id,user_id,role,status,joined_at) VALUES(?,?,'member','active',?)",[v.id,s.user.id,now]);
      db.run('INSERT OR REPLACE INTO group_member_keys(group_id,user_id,key_version,wrapped_key_ciphertext,wrapped_key_iv,wrapped_key_tag) VALUES(?,?,1,?,?,?)',[v.id,s.user.id,wrapped.ciphertext,wrapped.iv,wrapped.tag]);
      db.run(`INSERT INTO friend_contacts(user_id,group_id,peer_email,peer_name,status,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,group_id) DO UPDATE SET status=CASE WHEN friend_contacts.status='accepted' THEN 'accepted' ELSE excluded.status END,peer_name=excluded.peer_name`,[s.user.id,v.id,other,from ? v.peerName || other : v.name,status,now]);
      db.run('COMMIT');
    } catch(e) { db.run('ROLLBACK'); throw e; }
    save();
  }
  function invite(input) {
    const s=session(), email=account(input.email), folder=String(input.folderToken || '').trim();
    if (!email || email.length>254 || (!email.includes('@') && !/^\+?\d{6,}$/.test(email))) throw Error('请输入好友的邮箱或手机号');
    if (email===account(s.user.email)) throw Error('不能添加自己为好友');
    if (!folder || folder==='root' || folder.length>1000) throw Error('请填写双方有读写权限的飞书共享文件夹 Token');
    const v={version:1,kind:'request',id:crypto.randomUUID(),nonce:crypto.randomUUID(),ownerId:s.user.id,from:account(s.user.email),to:email,name:String(s.user.username || s.user.email).slice(0,100),folder,key:crypto.randomBytes(32).toString('base64'),expiresAt:new Date(Date.now()+7*86400000).toISOString()};
    // Re-export pending requests without making duplicate conversations.
    const pending=queryOne("SELECT c.group_id,c.status FROM friend_contacts c JOIN groups g ON g.id=c.group_id WHERE c.user_id=? AND c.peer_email=? AND c.status IN ('pending','accepted')",[s.user.id,email]);
    if (pending?.status === 'accepted') throw Error('已是好友，请从好友列表发起私聊');
    if (pending) {
      const oldRoom=queryOne('SELECT * FROM friend_rooms WHERE group_id=?',[pending.group_id]);
      const oldGroup=queryOne('SELECT * FROM groups WHERE id=?',[pending.group_id]);
      if (oldRoom.inviter_email !== account(s.user.email) || oldGroup.feishu_folder_token !== folder) throw Error('已有待确认邀请的目录不同，请先移除旧邀请');
      return {groupId:pending.group_id,code:seal({...v,id:pending.group_id,nonce:oldRoom.nonce,ownerId:oldGroup.owner_user_id,key:groups.getGroupKeyForUser(db,queryOne,pending.group_id,s.user.id,s.user,s.password).toString('base64')})};
    }
    put(v,s,'pending'); return {code:seal(v),groupId:v.id};
  }
  function inspect(input) { const s=session(),v=read(input.code); if ((v.kind==='device' ? v.deviceEmail : v.kind==='request' ? v.to : v.from)!==account(s.user.email)) throw Error('此邀请码属于其他账号'); const ownFrom=account(s.user.email)===v.from; return {kind:v.kind,email:ownFrom?v.to:v.from,name:ownFrom?v.peerName || v.to:v.name}; }
  function accept(input) {
    const s=session(),v=read(input.code); inspect(input);
    put(v,s,'accepted');
    return {groupId:v.id,code:v.kind==='request'?seal({...v,kind:'accepted',peerName:String(s.user.username || s.user.email).slice(0,100)}):''};
  }
  function update(input) {
    const s=session(); if (!queryOne('SELECT 1 FROM friend_contacts WHERE user_id=? AND group_id=?',[s.user.id,input.groupId])) throw Error('好友不存在');
    if (input.remove) db.run("UPDATE friend_contacts SET status='deleted' WHERE user_id=? AND group_id=?",[s.user.id,input.groupId]);
    else db.run('UPDATE friend_contacts SET remark=? WHERE user_id=? AND group_id=?',[String(input.remark || '').trim().slice(0,100),s.user.id,input.groupId]);
    save(); return list();
  }
  function exportDevice(input) {
    const s=session();
    const contact=queryOne("SELECT * FROM friend_contacts WHERE user_id=? AND group_id=? AND status='accepted'",[s.user.id,input.groupId]);
    if(!contact) throw Error('请先完成好友确认');
    const r=queryOne('SELECT * FROM friend_rooms WHERE group_id=?',[input.groupId]),g=queryOne('SELECT * FROM groups WHERE id=?',[input.groupId]);
    const isFrom=account(s.user.email)===r.inviter_email;
    const value={version:1,kind:'device',deviceEmail:account(s.user.email),id:g.id,nonce:r.nonce,ownerId:g.owner_user_id,from:r.inviter_email,to:r.invitee_email,name:isFrom?String(s.user.username || s.user.email).slice(0,100):contact.peer_name,peerName:isFrom?contact.peer_name:String(s.user.username || s.user.email).slice(0,100),folder:g.feishu_folder_token,key:groups.getGroupKeyForUser(db,queryOne,g.id,s.user.id,s.user,s.password).toString('base64'),expiresAt:new Date(Date.now()+7*86400000).toISOString()};
    return {code:seal(value)};
  }
  return {list,invite,inspect,accept,update,exportDevice};
}
module.exports={createFriendService};
