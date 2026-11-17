# 秘栈飞书扫码登录服务

Node.js 22+。在服务目录执行 `npm ci --omit=dev` 安装锁定的 WebSocket 依赖。默认只监听 127.0.0.1:3492，由 Nginx 提供 HTTPS。

环境配置放在服务器 `/etc/mizhan-auth.env`（root:root，0600），不要提交到仓库：

```
PUBLIC_URL=https://your-domain.example/mizhan-auth
PORT=3492
FEISHU_APP_ID=your-app-id
FEISHU_APP_SECRET=your-app-secret
TOKEN_KEY=64-hex-characters-generated-from-32-random-bytes
```

首次生成 TOKEN_KEY 后保持稳定；它同时保护托管刷新令牌和自动登录密钥。丢失或直接改变 TOKEN_KEY 会使现有自动登录密钥无法解密，不能用重新扫码代替恢复备份。环境文件由 systemd 读取，应用以 www-data 运行。

自动登录密钥保存在 `/var/lib/mizhan-auth/signin-keys`，可通过 `SIGNIN_KEY_DIR` 指定目录。每个飞书身份使用独立随机密钥，以 AES-256-GCM 加密保存，文件权限 0600，目录 0700；密文与应用 ID、飞书 open_id 绑定。部署时更新 systemd 单元并运行 `systemctl daemon-reload`，其中 `StateDirectory=mizhan-auth` 为 www-data 提供持久可写目录，重启服务后密钥仍保留。备份必须同时保留密钥目录和 TOKEN_KEY，不得清空密钥目录或轮换 TOKEN_KEY 来处理登录故障。

飞书后台的安全设置必须添加精确回调：`PUBLIC_URL/callback`。用户令牌申请范围包括 drive:drive、drive:drive:readonly、auth:user.id:read、wiki:wiki:readonly、offline_access，须按后台支持的权限完成开通、版本发布及可用范围配置。应用属于企业自建时，不会自动变成面向所有企业的公共登录应用。

协议与客户端现有托管同步兼容：

- POST /v1/feishu/oauth/sessions：创建十分钟会话，包含 loopback 回调、客户端 state、deviceId、SHA-256 challenge。
- GET /callback：校验独立的服务端 state，服务端换取授权令牌，重定向客户端仅携带一分钟票据。
- POST /v1/feishu/oauth/sessions/exchange：验证客户端 verifier 和全部会话绑定信息后，一次性交换令牌。
- POST /v1/feishu/oauth/refresh：刷新服务端加密封装的刷新令牌，Secret 不发往桌面端。
- POST /v1/feishu/signin-key：以 Bearer 用户令牌向飞书核验身份，再查询、创建或首次导入该身份的同步密钥。忽略客户端声明的 openId，不允许覆盖已有密钥。响应禁止缓存，不通过浏览器回调或渲染层传输密钥。
- GET /health：仅返回服务就绪状态。

不在日志中记录访问令牌、刷新令牌、授权码、同步密钥或用户本机密码；Nginx 专用路径关闭访问日志。内存授权票据重启后失效，需要重新扫码。持久化密钥以密文保存，服务器持有解密能力，因此托管模式属于密钥托管，不能宣称认证服务器无法解密。这里不保存密码库与聊天内容，账号归属由飞书身份及用户云盘中的加密账号资料恢复。

客户端的本机加密凭据与云端同步密钥相互独立，均由程序管理。扫码后自动创建/恢复账号并开启同步。本机解锁凭据以同步密钥加密缓存，授权后可再次解锁，不需用户记录。旧账号在已登录的原设备绑定时，使用已保存口令自动导入，不改写旧文件的加密格式；没有旧口令或本机解锁信息时才要求恢复一次，错误口令不会写入托管密钥库。自定义存储目录通过根目录中的加密定位资料发现。

客户端和认证服务需配套更新：部署 `server.js`、`signin-keys.js`、`chat-live.js`、npm 清单及 systemd 单元，安装依赖并重载/重启服务；既有 Nginx 前缀规则会覆盖新接口。仅更新客户端而未部署 `/v1/feishu/signin-key` 时，客户端会明确提示自动登录服务不可用，不会偷偷创建无法恢复的新账号。本地验证运行 `npm run test:managed-signin` 和 `npm run test:managed-signin:e2e`；真实扫码与跨物理设备仍需部署后验收。

部署实例（2026-11-10）：`https://axonclawx.cn/mizhan-auth`；服务名 mizhan-auth。Nginx 原文件备份在 `/var/backups/mizhan`。回滚可停用该服务并移除新增的专用 include，再 nginx -t 后 reload，保留环境文件以免丢失刷新密钥。

验证：`node scripts/test-managed-signin.js`。真实扫码、跨物理设备及企业外用户范围须另外验收。

同一账号的个人留言实时同步：

- 飞书云盘的加密账号资料包含 `chatLive`（协议版本、WSS 地址和资料库 ID）。旧账号资料在下一次正常上传时补写。桌面端使用本机配置的托管服务地址，不向云盘资料指定的任意地址发送飞书令牌。
- 托管客户端使用飞书用户令牌换取 30 秒内有效、仅可用一次的连接票据。服务端核验飞书身份，按身份和资料库 ID 分隔通道。
- 在线时，个人纯文字保存到本地后立即通过 WSS 转发端到端加密密文，服务端不归档。客户端后台批量归档飞书，归档后广播 `changed`，对端更新归档状态并去重。图片、文件和未在线送达的消息走飞书；重连会补拉，轮询继续兜底。群聊和好友私聊仍使用轮询。
- 更新部署时，替换 `server.js`、`chat-live.js` 和两个 npm 清单，在部署目录安装锁定依赖；将仓库中的 Nginx 配置同步到专用 include，验证 `nginx -t` 后重载，再重启 mizhan-auth。保留既有环境文件和 TOKEN_KEY。确认 HTTPS 健康检查后，用同一飞书账号的两台设备互发测试。
- 本地验证：`npm ci --prefix server/feishu-auth` 后运行 `node scripts/test-chat-live.js`。
