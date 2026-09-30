# AxonMind 托管同步服务契约

托管服务的职责仅限于保护飞书应用凭据并完成 OAuth 授权与令牌刷新。知识库内容、目录清单和账号资料由桌面端加密后直接写入飞书云盘，不经过托管服务。

## 客户端配置

正式构建通过环境变量 `AXONMIND_MANAGED_SERVICE_URL` 注入 HTTPS 服务根地址。没有配置时，客户端显示“托管服务等待上线”并禁用托管登录；个人自建和企业自建不受影响。

## API

### 创建授权会话

`POST /v1/feishu/oauth/sessions`

请求包含 `state`、桌面端本地回调地址 `redirectUri`、随机 `deviceId` 和仅作显示提示的 `accountEmail`。服务端不得把客户端提交的邮箱视为已验证身份。

响应：

```json
{ "authorizationUrl": "https://open.feishu.cn/..." }
```

### 兑换授权结果

完成飞书授权后，服务端将一次性 `ticket` 和原始 `state` 重定向到桌面端回调地址。桌面端调用：

`POST /v1/feishu/oauth/sessions/exchange`

```json
{ "ticket": "single-use-ticket", "state": "csrf-state", "deviceId": "local-device-id" }
```

响应包含飞书 `accessToken`、`refreshToken`、过期时间以及用户信息。ticket 必须短时有效、一次性使用，并绑定 state、deviceId 和授权主体。

### 刷新令牌

`POST /v1/feishu/oauth/refresh`

```json
{ "refreshToken": "..." }
```

服务端返回新的令牌和过期时间。刷新令牌不得写入日志，所有接口必须使用 HTTPS，并配置请求限流、审计、密钥轮换和最小飞书权限。

## 不变量

- 飞书 App Secret 只存在于托管服务的密钥管理系统，不随桌面包分发。
- 托管服务不接收端到端加密口令、知识正文、附件明文或本地解锁密码。
- 桌面端必须校验 OAuth state；服务端必须校验一次性 ticket 的主体与设备绑定。
- 上线前需要补齐服务端账号体系、隐私政策、用户撤销授权和令牌删除接口。
