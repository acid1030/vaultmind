# VaultMind

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Node](https://img.shields.io/badge/Node-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)

**VaultMind** 是一款面向个人与小团队的桌面知识库应用。它把文档、密钥、链接、代码项目与账号信息集中管理，支持**端到端加密**同步到飞书云盘，并通过本地全文检索与 AI 对话快速找到所需内容。

> 数据默认留在本机 SQLite；上云内容经 AES-256-GCM 加密，服务端（飞书）无法读取明文。

---

## 为什么选择 VaultMind

| 场景 | VaultMind 能做什么 |
|------|-------------------|
| 密码 / API Key / 证书 | 本地加密保存，可选同步到飞书保险箱 |
| 团队共享文档与密钥 | 用户组 + 组密钥，组员可见、个人空间仍隔离 |
| 多设备使用 | 加密 manifest 目录清单 + 按需拉取文件 |
| 知识分散在多处 | 统一搜索本地库，并连接远程 KB / 向量库 / Obsidian |
| 日常开发 | 管理 Git/SVN 仓库与 Token，在应用内执行常用命令 |

---

## 功能特性

### 身份与安全

- 本地账号注册 / 登录（邮箱或手机号）
- 恢复码找回本地密码
- **双口令模型**
  - **本地登录密码**：解锁本机 SQLite 中的内容
  - **飞书加密口令**：加密/解密上传到云端的 `.axonvault` 文件（不上传、不存储于云端）

### 内容库（个人 / 用户组）

- 支持类型：文件、文本、密钥、网页链接、视频链接
- 顶栏切换上下文：**个人** 或 **某一用户组**
- 个人内容默认不共享；可「复制到组」生成组内副本
- 本地 **FTS** 全文检索（标题与标签）

### 用户组协作

- 创建组、按邮箱邀请成员（须已在本应用注册）
- 登录后自动接受待处理邀请
- 角色：所有者 / 管理员 / 成员 / 只读
- 移除成员、轮换组密钥、调整角色

### 飞书云同步

- OAuth 登录飞书
- 单文件加密上传（当前约 **18MB** 单文件上限）
- **目录 manifest**：上传、拉取、完整同步（先拉取合并再上传）
- 远端仅有元数据的条目会标记为 **待下载**

### 知识检索与对话

- 配置 OpenAI-compatible / Claude 等大模型
- 连接远程知识库、向量库、Obsidian Local REST API
- 提问时 **优先检索本地库**，再聚合远程证据并由 LLM 生成回答

### 项目管理

- 保存 GitHub / GitLab / Git / SVN 账号（加密存储）
- 仓库配置与 clone、status、log、pull、commit、push 等快捷操作

---

## 快速开始

### 环境要求

- Node.js 18+
- macOS / Windows / Linux（Electron 桌面端）

### 安装与运行

```bash
git clone https://github.com/acid1030/vaultmind.git
cd vaultmind
npm install
npm start
```

### 运行测试

```bash
npm test
```

测试覆盖：用户组邀请入组、组密钥加解密、邀请密封、FTS 搜索、manifest 合并、密钥轮换等核心逻辑。

---

## 飞书开放平台配置

1. 在 [飞书开放平台](https://open.feishu.cn/app) 创建**企业自建应用**。
2. 在「安全设置」中添加 OAuth 重定向 URL：

   ```text
   http://127.0.0.1:37891/feishu/oauth/callback
   ```

3. 开通建议权限：

   - `drive:drive`
   - `drive:drive:readonly`
   - `auth:user.id:read`

4. 在 VaultMind「配置 → 飞书同步」中填写 **App ID**、**App Secret**，保存后登录飞书。

可选：为某个用户组单独配置 **飞书文件夹 Token**，组内同步文件会写入该目录。

---

## 典型工作流

```text
1. 注册本地账号并登录
2. （可选）配置飞书 → 登录飞书
3. 顶栏选择「个人」或「用户组」
4. 「添加」录入内容，或加密上传到飞书
5. 另一台设备：登录同一账号 + 飞书 →「从飞书拉取清单」→ 按需「取回入库」
6. 使用全局搜索或知识对话查找信息
```

### 邀请同事加入用户组

1. 「用户组」→ 创建组  
2. 填写对方**已注册**的邮箱 → 发送邀请  
3. 对方用**相同邮箱**登录后会自动入组  

### 成员离职

1. 在用户组中 **移除成员**  
2. 执行 **轮换组密钥**（重加密组内数据）  
3. 对仍需访问的成员 **重新邀请**  

---

## 项目结构

```text
vaultmind/
├── src/
│   ├── main.js              # Electron 主进程、IPC、飞书 API
│   ├── preload.js           # 安全桥接
│   ├── core/
│   │   ├── schema.js        # 数据库迁移
│   │   ├── groups.js        # 用户组与成员
│   │   ├── group-crypto.js  # 组密钥加解密
│   │   ├── invite-crypto.js # 邀请密封
│   │   ├── search.js        # FTS 索引与搜索
│   │   ├── manifest-sync.js # 目录清单同步
│   │   └── feishu-drive.js  # 飞书文件列表解析
│   └── renderer/            # 界面（HTML / CSS / JS）
├── scripts/
│   └── test-core.js         # 核心逻辑单元测试
├── package.json
└── README.md
```

本地数据库路径（Electron `userData`）：`secure-vault.sqlite`（应用内可打开所在目录）。

---

## 安全说明

- **端到端加密**：飞书上仅存密文；加密口令仅在你输入时用于加解密，不会上传。
- **组密钥**：组内内容使用独立的组密钥；成员通过 wrapped key 获得解密能力。
- **无法恢复的情况**：若忘记本地密码、飞书加密口令，或轮换密钥后未重新邀请成员，对应密文**无法找回**。
- **建议**：妥善保存恢复码；敏感生产密钥优先放在个人空间，再按需复制到组。

---

## 技术栈

- [Electron](https://www.electronjs.org/) — 跨平台桌面壳
- [sql.js](https://github.com/sql-js/sql.js) — 嵌入式 SQLite
- Node.js `crypto` — AES-256-GCM、PBKDF2-SHA256
- 飞书开放平台 — 云盘与 OAuth

---

## 参与与反馈

欢迎提交 [Issue](https://github.com/acid1030/vaultmind/issues) 与 Pull Request。

## 许可证

本项目采用 [MIT License](LICENSE) 开源。

---

<p align="center">
  <sub>VaultMind — 你的加密知识工作台</sub>
</p>
