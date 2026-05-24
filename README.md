# VaultMind

VaultMind 是独立桌面应用：个人/团队知识库、项目与账号管理、飞书加密同步、本地与远程统一检索。

## 功能概览

### 身份与安全
- 本地注册/登录、恢复码重置密码
- 本地密码保护 SQLite 内容；飞书加密口令保护云端 `.axonvault`
- 用户组使用独立 **组密钥**（成员加入后自动分发 wrapped key）

### 个人与组
- 顶栏切换 **个人 / 用户组** 上下文
- 组内：文档、密钥、项目配置共享
- 邀请成员（邮箱）；登录后 **自动接受** 待处理邀请
- 移除成员、轮换组密钥、修改成员角色

### 同步（飞书）
- 单文件加密上传（约 18MB）
- **目录 manifest**：上传 / 拉取 / 完整同步（先拉后推）
- 拉取后合并远端条目（标记「待下载」的元数据占位）

### 检索
- 本地 FTS 全局搜索
- 知识对话：先本地库，再远程 KB / 向量 / Obsidian + LLM

### 项目
- Git / SVN 账号、仓库、常用命令

## 运行

```bash
npm install
npm start
```

## 测试

```bash
npm test
```

覆盖：用户组邀请与入组、组密钥加解密、邀请密封、FTS、manifest 合并、密钥轮换。

## 飞书配置

重定向 URL：`http://127.0.0.1:37891/feishu/oauth/callback`

权限建议：`drive:drive`、`drive:drive:readonly`、`auth:user.id:read`

## 架构

```text
src/
  main.js
  preload.js
  core/
    schema.js
    groups.js
    group-crypto.js
    invite-crypto.js
    search.js
    manifest-sync.js
    feishu-drive.js
  renderer/
scripts/
  test-core.js
```

## 注意

- 轮换组密钥后，其他成员需 **重新邀请** 才能解密新内容。
- 邀请使用邮箱密封组密钥；用户须用 **注册时相同邮箱** 登录才能自动入组。
- 忘记飞书加密口令或组密钥将无法恢复对应密文。
