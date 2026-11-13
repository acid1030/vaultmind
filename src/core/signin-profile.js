const crypto=require('node:crypto');
const {hashFeishuOpenId}=require('./cloud-account');
function chooseSigninAccount({identity,profile,users,currentUser,passphrase,localPassword,hashPassword}) {
 if(!identity?.openId)throw Error('飞书没有返回有效身份，请重新授权');
 const openIdHash=hashFeishuOpenId(identity.openId);
 const email=String(profile?.email || identity.email || `feishu-${openIdHash.slice(0,24)}@mizhan.local`).trim().toLowerCase();
 const user=currentUser || users.find(u=>u.feishu_open_id_hash===openIdHash) || users.find(u=>u.email===email);
 if(currentUser?.feishu_open_id_hash&&currentUser.feishu_open_id_hash!==openIdHash)throw Error('当前账号已绑定其他飞书身份');
 if(profile&&user&&profile.email&&profile.email.toLowerCase()!==user.email.toLowerCase())throw Error('云端资料属于其他秘栈账号，请切换本地账号');
 if(user?.feishu_open_id_hash&&user.feishu_open_id_hash!==openIdHash)throw Error('本机账号已绑定其他飞书身份');
 if(user&&!currentUser){const password=localPassword||passphrase;if(hashPassword(password,user.password_salt)!==user.password_hash)return {needsLocalPassword:true,email:user.email};return {user,password,openIdHash,email}}
 return {user,password:currentUser?localPassword:passphrase,openIdHash,email,vaultId:profile?.vaultId || user?.vault_id || crypto.randomUUID()};
}
module.exports={chooseSigninAccount};
