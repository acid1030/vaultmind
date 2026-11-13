# 秘栈飞书扫码登录服务

Node.js 22+，无额外运行时依赖。默认只监听 127.0.0.1:3492，由 Nginx 提供 HTTPS。

环境配置放在服务器 `/etc/mizhan-auth.env`（root:root，0600），不要提交到仓库：

```
PUBLIC_URL=https://your-domain.example/mizhan-auth
PORT=3492
FEISHU_APP_ID=your-app-id
FEISHU_APP_SECRET=your-app-secret
TOKEN_KEY=64-hex-characters-generated-from-32-random-bytes
```

首次生成 TOKEN_KEY 后保持稳定；改变它会使已有托管刷新令牌失效，需要重新扫码。环境文件由 systemd 读取，应用以 www-data 运行。

飞书后台的安全设置必须添加精确回调：`PUBLIC_URL/callback`。用户令牌申请范围包括 drive:drive、drive:drive:readonly、auth:user.id:read、wiki:wiki:readonly、offline_access，须按后台支持的权限完成开通、版本发布及可用范围配置。应用属于企业自建时，不会自动变成面向所有企业的公共登录应用。

协议与客户端现有托管同步兼容：

- POST /v1/feishu/oauth/sessions：创建十分钟会话，包含 loopback 回调、客户端 state、deviceId、SHA-256 challenge。
- GET /callback：校验独立的服务端 state，服务端换取授权令牌，重定向客户端仅携带一分钟票据。
- POST /v1/feishu/oauth/sessions/exchange：验证客户端 verifier 和全部会话绑定信息后，一次性交换令牌。
- POST /v1/feishu/oauth/refresh：刷新服务端加密封装的刷新令牌，Secret 不发往桌面端。
- GET /health：仅返回服务就绪状态。

不记录访问令牌、刷新令牌、授权码、加密口令或用户本机密码；Nginx 专用路径关闭访问日志。内存会话重启后失效，需要重新扫码。这里不保存密码库与聊天内容，账号归属由飞书身份及用户云盘中的加密账号资料恢复。

客户端的本机密码与云端加密口令相互独立。新机器首次恢复以输入的加密口令设置本机解锁；原机器已有账号仍需原本机密码。原账号先在设置中扫码绑定一次。自定义存储目录通过根目录中的加密定位资料发现。

部署实例（2026-11-10）：`https://axonclawx.cn/mizhan-auth`；服务名 mizhan-auth。Nginx 原文件备份在 `/var/backups/mizhan`。回滚可停用该服务并移除新增的专用 include，再 nginx -t 后 reload，保留环境文件以免丢失刷新密钥。

验证：`node scripts/test-managed-signin.js`。真实扫码、跨物理设备及企业外用户范围须另外验收。
