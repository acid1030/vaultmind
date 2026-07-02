from pathlib import Path


OUT_DIR = Path("/Users/t/Documents/miiow_center/docs/analysis")
HTML_PATH = OUT_DIR / "miiow-center-architecture-techstack-detailed.html"


def write_html() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    HTML_PATH.write_text(
        r'''<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>Miiow Center 架构与技术栈详细说明</title>
  <style>
    @page {
      size: A4;
      margin: 14mm 12mm 16mm;
    }
    * {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      color: #172033;
      font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", Arial, sans-serif;
      font-size: 13px;
      line-height: 1.62;
      background: #ffffff;
    }
    h1, h2, h3 {
      margin: 0;
      color: #101827;
      font-weight: 760;
      letter-spacing: 0;
    }
    h1 {
      font-size: 28px;
      line-height: 1.25;
    }
    h2 {
      margin-top: 22px;
      padding-bottom: 6px;
      border-bottom: 2px solid #d8dee9;
      font-size: 20px;
    }
    h3 {
      margin-top: 16px;
      font-size: 15px;
    }
    p {
      margin: 8px 0;
    }
    table {
      width: 100%;
      margin: 10px 0 14px;
      border-collapse: collapse;
      table-layout: fixed;
    }
    th, td {
      padding: 7px 8px;
      border: 1px solid #d8dee9;
      vertical-align: top;
      word-break: break-word;
    }
    th {
      color: #111827;
      background: #eef2f7;
      font-weight: 700;
    }
    ul {
      margin: 6px 0 12px 20px;
      padding: 0;
    }
    li {
      margin: 3px 0;
    }
    code {
      padding: 1px 4px;
      border-radius: 4px;
      color: #27364f;
      background: #eef2f7;
      font-family: "SFMono-Regular", Consolas, monospace;
      font-size: 11px;
    }
    .cover {
      min-height: 252mm;
      padding-top: 34mm;
      page-break-after: always;
    }
    .cover-title {
      width: 86%;
      border-left: 8px solid #1b4d89;
      padding: 14px 0 16px 22px;
    }
    .cover-subtitle {
      margin-top: 18px;
      color: #526173;
      font-size: 15px;
    }
    .meta {
      margin-top: 34px;
      width: 68%;
      border-top: 1px solid #cfd7e3;
      padding-top: 14px;
      color: #526173;
      font-size: 13px;
    }
    .note {
      margin: 12px 0;
      padding: 9px 12px;
      border-left: 4px solid #1b4d89;
      background: #f5f8fc;
    }
    .section {
      page-break-inside: avoid;
    }
    .page-break {
      page-break-before: always;
    }
    .diagram {
      margin: 12px 0 16px;
      padding: 12px;
      border: 1px solid #d8dee9;
      background: #fbfcfe;
      page-break-inside: avoid;
    }
    .diagram-title {
      margin-bottom: 9px;
      color: #334155;
      font-weight: 700;
    }
    .layer-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 8px;
    }
    .layer {
      display: grid;
      grid-template-columns: 108px 1fr;
      gap: 10px;
      align-items: stretch;
    }
    .layer-name {
      padding: 9px;
      border: 1px solid #bcc9d8;
      background: #e7edf5;
      font-weight: 700;
      text-align: center;
    }
    .layer-items {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 7px;
    }
    .box {
      min-height: 44px;
      padding: 7px;
      border: 1px solid #b8c5d6;
      background: #ffffff;
      text-align: center;
    }
    .box strong {
      display: block;
      margin-bottom: 2px;
      color: #15243a;
    }
    .small {
      color: #5d6b7c;
      font-size: 11px;
      line-height: 1.35;
    }
    .flow {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 11px;
      align-items: center;
    }
    .flow .box {
      min-height: 68px;
      position: relative;
    }
    .flow .box:not(:last-child)::after {
      content: ">";
      position: absolute;
      right: -14px;
      top: 22px;
      color: #1b4d89;
      font-weight: 800;
    }
    .two-col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .stack {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 9px;
    }
    .stack .box {
      text-align: left;
    }
    .tag {
      display: inline-block;
      margin: 2px 4px 2px 0;
      padding: 2px 6px;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      color: #334155;
      background: #f8fafc;
      font-size: 11px;
    }
    .toc ol {
      margin: 8px 0 0 22px;
      padding: 0;
      columns: 2;
      column-gap: 26px;
    }
    .toc li {
      margin: 4px 0;
      break-inside: avoid;
    }
    .muted {
      color: #64748b;
    }
    .svg-diagram {
      width: 100%;
      height: auto;
      display: block;
      background: #fbfcfe;
    }
  </style>
</head>
<body>
  <section class="cover">
    <div class="cover-title">
      <h1>Miiow Center<br>架构设计与技术栈详细说明</h1>
      <div class="cover-subtitle">面向信息中心、后端开发、前端开发、产品与实施协同的工程说明文档</div>
    </div>
    <div class="meta">
      <p><strong>项目目录：</strong><code>/Users/t/Documents/miiow_center</code></p>
      <p><strong>代码基线：</strong>JEECG Boot 3.9.1 二次开发，前后端分离，保留单体与微服务两种运行形态。</p>
      <p><strong>生成日期：</strong>2026-07-02</p>
      <p><strong>文档目标：</strong>说明当前系统的真实架构、核心技术栈、模块职责、数据与部署视图，并给出生产落地建议。</p>
    </div>
  </section>

  <section class="toc page-break">
    <h2>目录</h2>
    <ol>
      <li>项目定位与边界</li>
      <li>总体架构视图</li>
      <li>后端架构与模块职责</li>
      <li>前端架构与页面组织</li>
      <li>核心请求链路</li>
      <li>数据架构与数据域</li>
      <li>AI/RAG 能力架构</li>
      <li>报表与低代码能力</li>
      <li>部署拓扑与环境规划</li>
      <li>技术栈清单与版本基线</li>
      <li>生产化治理建议</li>
      <li>后续建设路线</li>
    </ol>
  </section>

  <section class="page-break">
    <h2>1. 项目定位与边界</h2>
    <p>Miiow Center 当前代码基于 JEECG Boot 3.9.1，主体是企业管理后台和低代码平台能力的二次开发基座。它不是单一业务系统，而是承载用户、组织、权限、菜单、数据字典、在线表单、报表、OpenAPI、任务调度和 AI/RAG 等能力的平台型工程。</p>
    <p>从现有代码结构看，系统更适合作为“模块化单体优先”的信息中心基础平台推进：先稳定统一用户权限、菜单、数据源、报表和 AI 知识库能力，再按访问量、部署隔离、安全等级逐步拆分服务。仓库虽然保留了 Gateway、Nacos、Sentinel、XXL-JOB 等微服务组件，但当前业务边界仍主要以平台模块划分，直接全面微服务化会增加运维和排障复杂度。</p>
    <div class="note">
      <strong>当前建议：</strong>测试和早期生产采用单体后端 + Vue 管理端 + 独立 MySQL/Redis/PostgreSQL/对象存储。只有当报表、AI/RAG、开放接口或任务调度出现明确的资源隔离和独立伸缩诉求时，再拆为独立服务。
    </div>
    <table>
      <tr><th>目录</th><th>职责</th><th>生产关注点</th></tr>
      <tr><td><code>jeecg-boot</code></td><td>Java 后端 Maven 多模块工程，包含单体启动、系统模块、基础核心、AI/RAG、演示模块和微服务组件。</td><td>生产构建应剥离 demo/test 示例能力，配置密钥外置。</td></tr>
      <tr><td><code>jeecgboot-vue3</code></td><td>Vue3 + Vite 管理端，后端权限模式，菜单和路由从后端加载。</td><td>统一 pnpm 构建，按路由分包，生产域名与 API 地址分环境管理。</td></tr>
      <tr><td><code>jeecg-boot/db</code></td><td>MySQL、Nacos、XXL-JOB 初始化脚本。</td><td>初始化脚本应拆分结构、基础数据、演示数据、历史日志。</td></tr>
      <tr><td><code>docs/analysis</code></td><td>项目分析、架构、技术栈、数据库结构和规范文档。</td><td>作为后续研发和交付文档的维护入口。</td></tr>
    </table>
  </section>

  <section class="page-break">
    <h2>2. 总体架构视图</h2>
    <p>系统总体分为访问层、前端层、接口层、后端业务层、平台基础层、数据与外部依赖层。前端通过 Axios 访问后端 REST API；后端通过 Shiro + JWT 做认证授权，通过 MyBatis-Plus 访问主库，通过 Redis 支撑缓存和分布式能力，通过对象存储保存附件，通过 PostgreSQL/pgvector 支撑 AI/RAG 向量检索。</p>
    <div class="diagram">
      <div class="diagram-title">图 1：Miiow Center 总体架构</div>
      <div class="layer-grid">
        <div class="layer">
          <div class="layer-name">访问层</div>
          <div class="layer-items">
            <div class="box"><strong>信息中心管理员</strong><span class="small">用户、权限、菜单、租户、配置治理</span></div>
            <div class="box"><strong>开发人员</strong><span class="small">接口、模块、低代码扩展、AI/RAG</span></div>
            <div class="box"><strong>产品/实施</strong><span class="small">菜单、表单、报表、知识库配置</span></div>
            <div class="box"><strong>外部系统</strong><span class="small">OpenAPI、SSO、第三方消息</span></div>
          </div>
        </div>
        <div class="layer">
          <div class="layer-name">前端层</div>
          <div class="layer-items">
            <div class="box"><strong>Vue3 管理端</strong><span class="small">Vite、TypeScript、Ant Design Vue</span></div>
            <div class="box"><strong>权限路由</strong><span class="small">BACK 模式，菜单由后端返回</span></div>
            <div class="box"><strong>低代码页面</strong><span class="small">@jeecg/online、表单、报表入口</span></div>
            <div class="box"><strong>AI 页面</strong><span class="small">聊天、知识库、应用配置</span></div>
          </div>
        </div>
        <div class="layer">
          <div class="layer-name">接口层</div>
          <div class="layer-items">
            <div class="box"><strong>REST API</strong><span class="small">/jeecg-boot</span></div>
            <div class="box"><strong>认证授权</strong><span class="small">Shiro、JWT、数据权限</span></div>
            <div class="box"><strong>接口文档</strong><span class="small">Knife4j / Swagger UI</span></div>
            <div class="box"><strong>开放接口</strong><span class="small">OpenAPI 授权、日志、权限</span></div>
          </div>
        </div>
        <div class="layer">
          <div class="layer-name">业务层</div>
          <div class="layer-items">
            <div class="box"><strong>系统管理</strong><span class="small">用户、角色、菜单、部门、租户、字典</span></div>
            <div class="box"><strong>低代码/报表</strong><span class="small">Online、JimuReport、数据源</span></div>
            <div class="box"><strong>AI/RAG</strong><span class="small">模型、知识库、提示词、MCP、Word 模板</span></div>
            <div class="box"><strong>调度与消息</strong><span class="small">Quartz、XXL-JOB、站内信、短信、邮件</span></div>
          </div>
        </div>
        <div class="layer">
          <div class="layer-name">数据层</div>
          <div class="layer-items">
            <div class="box"><strong>MySQL</strong><span class="small">主业务库、平台元数据、报表元数据</span></div>
            <div class="box"><strong>Redis</strong><span class="small">缓存、Token、分布式锁、Redisson</span></div>
            <div class="box"><strong>PostgreSQL</strong><span class="small">AI/RAG 向量库，建议 pgvector</span></div>
            <div class="box"><strong>对象存储</strong><span class="small">local、MinIO、OSS、七牛</span></div>
          </div>
        </div>
      </div>
    </div>

    <h3>架构边界说明</h3>
    <table>
      <tr><th>边界</th><th>当前实现</th><th>设计取舍</th></tr>
      <tr><td>前后端边界</td><td>前端通过 <code>VITE_GLOB_DOMAIN_URL</code> 和 <code>VITE_GLOB_API_URL</code> 访问后端，后端默认 <code>/jeecg-boot</code> 上下文。</td><td>适合统一管理端；生产建议由 Nginx 做静态资源和 API 反向代理。</td></tr>
      <tr><td>平台与业务边界</td><td>系统管理、报表、低代码、AI/RAG 同属平台能力，业务扩展可在独立模块中接入。</td><td>避免业务代码散落在 system 模块；新业务应单独包或 Maven 模块承载。</td></tr>
      <tr><td>单体与微服务边界</td><td>单体启动为主，微服务组件保留在 <code>jeecg-server-cloud</code>。</td><td>先按模块治理，再按部署隔离拆服务。</td></tr>
    </table>
  </section>

  <section class="page-break">
    <h2>3. 后端架构与模块职责</h2>
    <p>后端采用 Maven 多模块组织。根工程声明 JEECG Boot 3.9.1、Java 17、Spring Boot 3.5.5，并统一管理 Spring Cloud、Spring Cloud Alibaba、MyBatis-Plus、Druid、Shiro、JimuReport、XXL-JOB、MinIO 等依赖版本。</p>
    <div class="diagram">
      <div class="diagram-title">图 2：后端 Maven 模块与依赖关系</div>
      <svg class="svg-diagram" viewBox="0 0 980 520" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="后端 Maven 模块架构">
        <defs>
          <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
            <path d="M0,0 L0,6 L9,3 z" fill="#1b4d89"/>
          </marker>
          <style>
            .node{fill:#fff;stroke:#9fb0c3;stroke-width:1.4}
            .group{fill:#f5f8fc;stroke:#c7d2df;stroke-width:1.2}
            .title{font:700 15px sans-serif;fill:#15243a}
            .text{font:12px sans-serif;fill:#405166}
            .line{stroke:#1b4d89;stroke-width:1.6;marker-end:url(#arrow)}
          </style>
        </defs>
        <rect x="30" y="24" width="920" height="472" rx="6" class="group"/>
        <text x="50" y="54" class="title">jeecg-boot-parent 3.9.1</text>
        <rect x="70" y="92" width="230" height="108" rx="5" class="node"/>
        <text x="92" y="122" class="title">jeecg-boot-base-core</text>
        <text x="92" y="148" class="text">公共工具、缓存、异常、字典</text>
        <text x="92" y="170" class="text">权限切面、查询构造、文件能力</text>
        <rect x="375" y="92" width="230" height="108" rx="5" class="node"/>
        <text x="397" y="122" class="title">jeecg-module-system</text>
        <text x="397" y="148" class="text">system-api / system-biz / start</text>
        <text x="397" y="170" class="text">用户、角色、菜单、租户、字典</text>
        <rect x="680" y="92" width="230" height="108" rx="5" class="node"/>
        <text x="702" y="122" class="title">jeecg-boot-module</text>
        <text x="702" y="148" class="text">airag / demo</text>
        <text x="702" y="170" class="text">AI 应用、知识库、提示词、Word 模板</text>
        <rect x="70" y="260" width="230" height="104" rx="5" class="node"/>
        <text x="92" y="290" class="title">单体启动</text>
        <text x="92" y="316" class="text">jeecg-system-start</text>
        <text x="92" y="338" class="text">端口 8080，上下文 /jeecg-boot</text>
        <rect x="375" y="260" width="230" height="104" rx="5" class="node"/>
        <text x="397" y="290" class="title">微服务组件</text>
        <text x="397" y="316" class="text">Gateway、Nacos、System Cloud</text>
        <text x="397" y="338" class="text">Sentinel、XXL-JOB、Visual</text>
        <rect x="680" y="260" width="230" height="104" rx="5" class="node"/>
        <text x="702" y="290" class="title">外部依赖</text>
        <text x="702" y="316" class="text">MySQL、Redis、PostgreSQL</text>
        <text x="702" y="338" class="text">MinIO/OSS、短信、邮件、模型服务</text>
        <line x1="300" y1="146" x2="375" y2="146" class="line"/>
        <line x1="605" y1="146" x2="680" y2="146" class="line"/>
        <line x1="185" y1="200" x2="185" y2="260" class="line"/>
        <line x1="490" y1="200" x2="490" y2="260" class="line"/>
        <line x1="795" y1="200" x2="795" y2="260" class="line"/>
        <rect x="70" y="410" width="840" height="44" rx="5" fill="#e7edf5" stroke="#b8c5d6"/>
        <text x="92" y="438" class="text">开发约束：Controller 只做入口和校验，ServiceImpl 负责业务编排，Mapper/XML 只做数据访问，跨模块调用优先依赖 API 抽象。</text>
      </svg>
    </div>
    <table>
      <tr><th>模块</th><th>职责</th><th>建议治理方式</th></tr>
      <tr><td><code>jeecg-boot-base-core</code></td><td>公共基础能力，包括异常处理、缓存、字典翻译、查询构造、文件上传、通用 API 抽象、权限切面、数据权限注解等。</td><td>保持稳定，避免业务逻辑下沉到 core；新增公共能力必须满足多模块复用。</td></tr>
      <tr><td><code>jeecg-system-api</code></td><td>系统模块 API 抽象，区分 local/cloud 调用方式。</td><td>跨模块调用优先走 API，不直接依赖 system-biz 内部实现。</td></tr>
      <tr><td><code>jeecg-system-biz</code></td><td>系统业务实现，包括用户、角色、菜单、租户、部门、字典、日志、消息、OSS、OpenAPI、Quartz、监控等。</td><td>作为平台核心域，避免承载具体业务系统的表单和流程。</td></tr>
      <tr><td><code>jeecg-system-start</code></td><td>单体启动入口，默认端口 8080，上下文 <code>/jeecg-boot</code>。</td><td>推荐测试和早期生产优先使用；通过 profile 区分 dev/test/prod/docker。</td></tr>
      <tr><td><code>jeecg-boot-module-airag</code></td><td>AI 应用、LLM、知识库、OCR、提示词、Word 模板等功能。</td><td>作为独立业务域治理权限、审计、模型 Key、向量库和工具白名单。</td></tr>
      <tr><td><code>jeecg-module-demo</code></td><td>演示和测试业务，包括示例页面、云服务示例、测试 Controller。</td><td>生产构建不应暴露 demo/test 菜单和接口。</td></tr>
      <tr><td><code>jeecg-server-cloud</code></td><td>微服务模式相关组件，包括 Gateway、Nacos、System Cloud、Demo Cloud、Visual 等。</td><td>作为中长期拆分选项，不建议在业务边界未稳定前全面启用。</td></tr>
    </table>
  </section>

  <section class="page-break">
    <h2>4. 前端架构与页面组织</h2>
    <p>前端采用 Vue 3、Vite、TypeScript 和 Ant Design Vue，配合 Pinia、Vue Router、Axios、ECharts、vxe-table、qiankun 插件等构成管理端。权限模式配置为 <code>PermissionModeEnum.BACK</code>，意味着菜单、路由和按钮权限由后端返回，适合信息中心集中授权和多角色运维。</p>
    <div class="diagram">
      <div class="diagram-title">图 3：前端分层结构</div>
      <div class="flow">
        <div class="box"><strong>入口与构建</strong><span class="small">Vite、环境变量、代理、qiankun base</span></div>
        <div class="box"><strong>路由与权限</strong><span class="small">router guard、BACK 菜单、动态路由</span></div>
        <div class="box"><strong>状态与请求</strong><span class="small">Pinia、Axios、Token、错误处理</span></div>
        <div class="box"><strong>页面与组件</strong><span class="small">views、components、layouts、jeecg 组件</span></div>
        <div class="box"><strong>业务能力</strong><span class="small">系统管理、报表、OpenAPI、AI/RAG</span></div>
      </div>
    </div>
    <table>
      <tr><th>目录/配置</th><th>职责</th><th>说明</th></tr>
      <tr><td><code>src/views</code></td><td>页面视图</td><td>包含 dashboard、system、sys、monitor、openapi、report、super/airag 等业务页面。</td></tr>
      <tr><td><code>src/components</code></td><td>通用组件</td><td>包含表格、表单、弹窗、上传、Markdown、Word 模板、JEECG 组件等。</td></tr>
      <tr><td><code>src/router</code></td><td>路由与菜单</td><td>后端权限模式下，动态路由由登录用户权限决定。</td></tr>
      <tr><td><code>src/store</code></td><td>Pinia 状态</td><td>管理用户、权限、应用配置、标签页等状态。</td></tr>
      <tr><td><code>src/utils/http/axios</code></td><td>请求封装</td><td>统一处理 API 地址、Token、参数拼接、错误提示和上传地址。</td></tr>
      <tr><td><code>.env.*</code></td><td>环境配置</td><td>定义 <code>VITE_GLOB_DOMAIN_URL</code>、<code>VITE_GLOB_API_URL</code>、qiankun、SSO 等。</td></tr>
    </table>
    <div class="note">
      <strong>前端生产建议：</strong>统一 pnpm；保留后端权限模式；生产环境不要把 <code>VITE_GLOB_DOMAIN_URL</code> 固定为本机地址；通过 Nginx 或网关统一域名，减少跨域和部署差异。
    </div>
  </section>

  <section class="page-break">
    <h2>5. 核心请求链路</h2>
    <p>典型请求从浏览器进入 Vue 页面，经过 Axios 拦截器附加 Token 和统一参数，再访问后端 Controller。后端经过 Shiro/JWT 校验、权限注解、数据权限切面、Service 业务编排、Mapper/XML 数据访问，最后通过统一 <code>Result</code> 包装返回。</p>
    <div class="diagram">
      <div class="diagram-title">图 4：认证授权与业务请求链路</div>
      <div class="flow">
        <div class="box"><strong>浏览器</strong><span class="small">登录态、菜单、页面操作</span></div>
        <div class="box"><strong>Axios 拦截器</strong><span class="small">Token、baseURL、错误处理、上传地址</span></div>
        <div class="box"><strong>Shiro / JWT</strong><span class="small">身份认证、接口鉴权、排除白名单</span></div>
        <div class="box"><strong>业务分层</strong><span class="small">Controller - Service - Mapper</span></div>
        <div class="box"><strong>数据与缓存</strong><span class="small">MySQL、Redis、对象存储、向量库</span></div>
      </div>
    </div>
    <h3>登录与权限加载</h3>
    <ul>
      <li>用户登录后，后端签发 JWT，前端保存登录态并进入权限初始化流程。</li>
      <li>前端 BACK 权限模式从后端获取菜单和按钮权限，动态生成可访问路由。</li>
      <li>后端接口侧仍需保留权限校验，前端菜单隐藏不能替代服务端授权。</li>
      <li>多租户、部门、角色、数据权限需要在后端切面和查询条件中统一收口。</li>
    </ul>
    <h3>异常、日志与审计</h3>
    <ul>
      <li>Controller 不直接吞异常，统一由全局异常处理和 <code>Result</code> 返回结构承接。</li>
      <li>关键操作使用日志注解和系统日志表记录，AI/RAG、OpenAPI、报表导出等高风险操作应单独审计。</li>
      <li>生产环境不建议向前端返回完整堆栈；详细异常保留在服务端日志和链路追踪中。</li>
    </ul>
  </section>

  <section class="page-break">
    <h2>6. 数据架构与数据域</h2>
    <p>主初始化 SQL 当前约 145 张表，覆盖系统基础、低代码、报表、AI/RAG、OpenAPI、调度和演示测试数据。数据架构的关键问题不是“表很多”，而是需要区分平台元数据、业务数据、演示数据和运行日志，避免生产初始化脚本混杂历史日志和示例表。</p>
    <div class="diagram">
      <div class="diagram-title">图 5：数据域与存储关系</div>
      <svg class="svg-diagram" viewBox="0 0 980 430" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="数据域架构">
        <defs>
          <marker id="arrow2" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
            <path d="M0,0 L0,6 L9,3 z" fill="#1b4d89"/>
          </marker>
          <style>
            .node{fill:#fff;stroke:#9fb0c3;stroke-width:1.4}
            .store{fill:#edf6f2;stroke:#8ab8a0;stroke-width:1.4}
            .title{font:700 14px sans-serif;fill:#15243a}
            .text{font:12px sans-serif;fill:#405166}
            .line{stroke:#1b4d89;stroke-width:1.5;marker-end:url(#arrow2)}
          </style>
        </defs>
        <rect x="40" y="42" width="180" height="82" rx="5" class="node"/>
        <text x="66" y="74" class="title">系统基础域</text>
        <text x="66" y="98" class="text">sys_* 用户/角色/菜单/字典</text>
        <rect x="40" y="160" width="180" height="82" rx="5" class="node"/>
        <text x="66" y="192" class="title">低代码域</text>
        <text x="66" y="216" class="text">onl_* 在线表单/数据集</text>
        <rect x="40" y="278" width="180" height="82" rx="5" class="node"/>
        <text x="66" y="310" class="title">报表域</text>
        <text x="66" y="334" class="text">jimu_* / rep_* 报表元数据</text>
        <rect x="398" y="42" width="184" height="82" rx="5" class="node"/>
        <text x="424" y="74" class="title">AI/RAG 域</text>
        <text x="424" y="98" class="text">airag_* / aigc_* 知识库</text>
        <rect x="398" y="160" width="184" height="82" rx="5" class="node"/>
        <text x="424" y="192" class="title">开放接口域</text>
        <text x="424" y="216" class="text">open_api* 授权/日志/权限</text>
        <rect x="398" y="278" width="184" height="82" rx="5" class="node"/>
        <text x="424" y="310" class="title">调度消息域</text>
        <text x="424" y="334" class="text">qrtz_* / xxl_job_* / message</text>
        <rect x="730" y="44" width="190" height="88" rx="8" class="store"/>
        <text x="766" y="78" class="title">MySQL 主库</text>
        <text x="766" y="102" class="text">平台元数据、业务数据、日志</text>
        <rect x="730" y="166" width="190" height="82" rx="8" class="store"/>
        <text x="766" y="198" class="title">Redis</text>
        <text x="766" y="222" class="text">缓存、Token、锁、临时状态</text>
        <rect x="730" y="284" width="190" height="82" rx="8" class="store"/>
        <text x="766" y="316" class="title">PostgreSQL / OSS</text>
        <text x="766" y="340" class="text">向量库、附件、文档、图片</text>
        <line x1="220" y1="83" x2="730" y2="83" class="line"/>
        <line x1="220" y1="201" x2="730" y2="92" class="line"/>
        <line x1="220" y1="319" x2="730" y2="92" class="line"/>
        <line x1="582" y1="83" x2="730" y2="325" class="line"/>
        <line x1="582" y1="201" x2="730" y2="92" class="line"/>
        <line x1="582" y1="319" x2="730" y2="207" class="line"/>
      </svg>
    </div>
    <table>
      <tr><th>数据域</th><th>主要表/前缀</th><th>治理建议</th></tr>
      <tr><td>系统基础</td><td><code>sys_*</code></td><td>作为平台主数据管理，重点治理用户、角色、菜单、租户、部门、字典和操作日志。</td></tr>
      <tr><td>低代码</td><td><code>onl_*</code></td><td>区分设计态和发布态；生产建议开启低代码安全模式，限制在线 SQL 和动态数据源。</td></tr>
      <tr><td>报表</td><td><code>jimu_*</code>、<code>rep_*</code></td><td>报表数据源、参数、导出权限、敏感字段脱敏需要单独规范。</td></tr>
      <tr><td>AI/RAG</td><td><code>airag_*</code>、<code>aigc_*</code></td><td>模型配置、提示词、知识库、向量库、工具调用必须权限隔离和审计。</td></tr>
      <tr><td>OpenAPI</td><td><code>open_api*</code></td><td>开放接口授权、访问频控、签名、日志留存、调用方隔离应成为生产必选项。</td></tr>
      <tr><td>演示测试</td><td><code>demo</code>、<code>test_*</code>、<code>jeecg_order_*</code></td><td>生产初始化不导入，生产菜单不暴露，示例 Controller 不开放。</td></tr>
    </table>
  </section>

  <section class="page-break">
    <h2>7. AI/RAG 能力架构</h2>
    <p>AI/RAG 模块不是简单聊天入口，而是一组围绕模型、知识库、提示词、文档解析、向量检索、AI 应用和工具调用的能力。现有代码包含 <code>app</code>、<code>llm</code>、<code>ocr</code>、<code>prompts</code>、<code>wordtpl</code> 等目录，说明模块已经具备应用配置、知识检索、文档处理和模板生成的基础。</p>
    <div class="diagram">
      <div class="diagram-title">图 6：AI/RAG 处理链路</div>
      <div class="flow">
        <div class="box"><strong>资料接入</strong><span class="small">文件、FAQ、业务文档、模板</span></div>
        <div class="box"><strong>解析切分</strong><span class="small">OCR、文本抽取、Chunk、元数据</span></div>
        <div class="box"><strong>向量入库</strong><span class="small">Embedding、pgvector、知识库索引</span></div>
        <div class="box"><strong>检索增强</strong><span class="small">召回、重排、提示词组装</span></div>
        <div class="box"><strong>应用输出</strong><span class="small">问答、Word 模板、工具调用、审计</span></div>
      </div>
    </div>
    <h3>生产控制点</h3>
    <table>
      <tr><th>控制点</th><th>原因</th><th>建议</th></tr>
      <tr><td>模型 Key 与供应商</td><td>配置泄漏会造成成本和数据风险。</td><td>全部外置到密文配置；按环境区分测试模型和生产模型。</td></tr>
      <tr><td>知识库权限</td><td>不同部门文档不能被无权限用户检索到。</td><td>知识库、文档、向量元数据都带租户/部门/角色约束。</td></tr>
      <tr><td>工具调用</td><td>SQL、stdio、MCP 等工具可能执行敏感动作。</td><td>默认白名单关闭，启用前登记用途、参数范围、审计日志和人工审批。</td></tr>
      <tr><td>输出审计</td><td>AI 输出可能引用错误或泄露敏感内容。</td><td>记录问题、召回片段、模型、提示词版本、输出摘要和用户。</td></tr>
    </table>
  </section>

  <section class="page-break">
    <h2>8. 报表与低代码能力</h2>
    <p>系统保留 Online 表单、JimuReport、数据源管理、报表大屏和文档预览等能力。该能力适合信息中心快速交付内部管理页面和查询报表，但生产使用必须有边界：低代码用于配置和快速交付，不应绕过代码评审、数据权限、SQL 安全和发布流程。</p>
    <div class="diagram">
      <div class="diagram-title">图 7：低代码与报表运行结构</div>
      <div class="two-col">
        <div>
          <h3>设计态</h3>
          <div class="stack">
            <div class="box"><strong>Online 表单</strong><span class="small">表结构、字段、校验、页面配置</span></div>
            <div class="box"><strong>报表设计</strong><span class="small">数据集、参数、模板、导出配置</span></div>
            <div class="box"><strong>数据源配置</strong><span class="small">主库、外部库、API 数据源</span></div>
          </div>
        </div>
        <div>
          <h3>运行态</h3>
          <div class="stack">
            <div class="box"><strong>权限校验</strong><span class="small">菜单、按钮、数据权限、报表授权</span></div>
            <div class="box"><strong>查询执行</strong><span class="small">参数绑定、分页、字典翻译、导出</span></div>
            <div class="box"><strong>审计治理</strong><span class="small">访问日志、导出日志、敏感字段控制</span></div>
          </div>
        </div>
      </div>
    </div>
    <ul>
      <li>开发环境可保留低代码设计能力，测试环境建议只允许受控人员配置，生产环境建议使用发布态。</li>
      <li>报表 SQL 数据集必须限制动态 SQL、跨库访问、敏感字段和大结果集导出。</li>
      <li>JimuReport 和 Online 的菜单、角色授权、数据源账号应单独纳入信息中心权限清单。</li>
      <li>示例报表、demo 数据和历史日志不应进入生产初始化脚本。</li>
    </ul>
  </section>

  <section class="page-break">
    <h2>9. 部署拓扑与环境规划</h2>
    <p>系统可支持本地开发、测试、生产单体和生产微服务四种形态。考虑当前代码边界和团队运维成本，建议以“生产单体 + 独立基础设施”为第一阶段目标，把微服务作为后续扩展形态。</p>
    <div class="diagram">
      <div class="diagram-title">图 8：推荐生产部署拓扑</div>
      <svg class="svg-diagram" viewBox="0 0 980 460" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="部署拓扑">
        <defs>
          <marker id="arrow3" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
            <path d="M0,0 L0,6 L9,3 z" fill="#1b4d89"/>
          </marker>
          <style>
            .node{fill:#fff;stroke:#9fb0c3;stroke-width:1.4}
            .infra{fill:#edf6f2;stroke:#8ab8a0;stroke-width:1.4}
            .zone{fill:#f5f8fc;stroke:#c7d2df;stroke-width:1.2}
            .title{font:700 14px sans-serif;fill:#15243a}
            .text{font:12px sans-serif;fill:#405166}
            .line{stroke:#1b4d89;stroke-width:1.5;marker-end:url(#arrow3)}
          </style>
        </defs>
        <rect x="28" y="30" width="924" height="388" rx="6" class="zone"/>
        <text x="50" y="60" class="title">生产单体优先拓扑</text>
        <rect x="62" y="98" width="150" height="76" rx="5" class="node"/>
        <text x="92" y="128" class="title">用户浏览器</text>
        <text x="82" y="152" class="text">HTTPS 访问</text>
        <rect x="270" y="98" width="165" height="76" rx="5" class="node"/>
        <text x="310" y="128" class="title">Nginx</text>
        <text x="290" y="152" class="text">静态资源 / API 代理</text>
        <rect x="500" y="88" width="178" height="96" rx="5" class="node"/>
        <text x="535" y="120" class="title">Vue3 前端</text>
        <text x="520" y="146" class="text">构建产物 dist</text>
        <text x="520" y="166" class="text">菜单/路由由后端返回</text>
        <rect x="500" y="236" width="178" height="96" rx="5" class="node"/>
        <text x="532" y="268" class="title">后端单体</text>
        <text x="520" y="294" class="text">jeecg-system-start</text>
        <text x="520" y="314" class="text">8080 /jeecg-boot</text>
        <rect x="740" y="62" width="150" height="70" rx="5" class="infra"/>
        <text x="785" y="92" class="title">MySQL</text>
        <text x="765" y="114" class="text">业务与平台主库</text>
        <rect x="740" y="152" width="150" height="70" rx="5" class="infra"/>
        <text x="786" y="182" class="title">Redis</text>
        <text x="762" y="204" class="text">缓存/Token/锁</text>
        <rect x="740" y="242" width="150" height="70" rx="5" class="infra"/>
        <text x="769" y="272" class="title">PostgreSQL</text>
        <text x="765" y="294" class="text">AI 向量库</text>
        <rect x="740" y="332" width="150" height="70" rx="5" class="infra"/>
        <text x="762" y="362" class="title">MinIO / OSS</text>
        <text x="764" y="384" class="text">附件和文档</text>
        <line x1="212" y1="136" x2="270" y2="136" class="line"/>
        <line x1="435" y1="136" x2="500" y2="136" class="line"/>
        <line x1="352" y1="174" x2="500" y2="278" class="line"/>
        <line x1="678" y1="284" x2="740" y2="97" class="line"/>
        <line x1="678" y1="284" x2="740" y2="187" class="line"/>
        <line x1="678" y1="284" x2="740" y2="277" class="line"/>
        <line x1="678" y1="284" x2="740" y2="367" class="line"/>
      </svg>
    </div>
    <table>
      <tr><th>环境</th><th>形态</th><th>部署说明</th></tr>
      <tr><td>本地开发</td><td>Vite dev server + 单体后端 + 本地/容器数据库</td><td>调试效率最高，适合开发联调；允许低代码 dev 模式。</td></tr>
      <tr><td>测试环境</td><td>单体后端 + 独立 MySQL/Redis/PostgreSQL</td><td>接近生产配置；限制在线设计权限；验证初始化脚本和发布流程。</td></tr>
      <tr><td>生产一期</td><td>Nginx + Vue 静态资源 + 后端单体 + 独立基础设施</td><td>推荐方案；减少微服务运维复杂度，优先做好权限、日志、备份、监控。</td></tr>
      <tr><td>生产二期</td><td>Gateway + System + AI/RAG + Report/Job 分服务</td><td>仅在访问压力、资源隔离、团队运维能力成熟后推进。</td></tr>
    </table>
  </section>

  <section class="page-break">
    <h2>10. 技术栈清单与版本基线</h2>
    <h3>后端技术栈</h3>
    <table>
      <tr><th>分类</th><th>技术</th><th>当前版本/配置</th><th>用途</th></tr>
      <tr><td>语言</td><td>Java</td><td>17</td><td>当前编译基线；POM 注释支持 17、21、24。</td></tr>
      <tr><td>主框架</td><td>Spring Boot</td><td>3.5.5</td><td>Web、配置、依赖管理和运行时基础。</td></tr>
      <tr><td>微服务</td><td>Spring Cloud / Alibaba</td><td>2025.0.0 / 2023.0.3.3</td><td>Gateway、Nacos、Sentinel 等微服务能力。</td></tr>
      <tr><td>ORM</td><td>MyBatis-Plus</td><td>3.5.12</td><td>Entity、Mapper、XML、分页和通用 CRUD。</td></tr>
      <tr><td>数据源</td><td>dynamic-datasource / Druid</td><td>4.3.1 / 1.2.24</td><td>多数据源、连接池和监控。</td></tr>
      <tr><td>认证授权</td><td>Apache Shiro / java-jwt</td><td>2.0.5 / 4.5.0</td><td>登录、接口鉴权、Token。</td></tr>
      <tr><td>数据库</td><td>MySQL + 可选国产/异构库</td><td>脚本为 MySQL 5.7 风格，驱动 8.0.27</td><td>主业务库；另有 PostgreSQL、Oracle、SQLServer、达梦、人大金仓配置。</td></tr>
      <tr><td>缓存</td><td>Redis / Redisson</td><td>Spring Data Redis，Redisson 配置</td><td>缓存、Token、分布式锁。</td></tr>
      <tr><td>报表</td><td>JimuReport</td><td>2.3.0</td><td>积木报表、数据集、导出、大屏。</td></tr>
      <tr><td>任务</td><td>Quartz / XXL-JOB</td><td>XXL-JOB 2.4.1</td><td>本地调度和分布式任务。</td></tr>
      <tr><td>文件</td><td>local / MinIO / OSS / 七牛</td><td>MinIO 8.5.7，OSS 3.17.3</td><td>附件、图片、文档和报表资源。</td></tr>
      <tr><td>接口文档</td><td>Knife4j</td><td>4.5.0</td><td>Swagger/OpenAPI 展示。</td></tr>
    </table>
    <h3>前端技术栈</h3>
    <table>
      <tr><th>分类</th><th>技术</th><th>当前版本/配置</th><th>用途</th></tr>
      <tr><td>主框架</td><td>Vue</td><td>3.5.22</td><td>管理端页面和组件。</td></tr>
      <tr><td>构建</td><td>Vite</td><td>6.3.6</td><td>开发服务器、构建、代理、插件体系。</td></tr>
      <tr><td>语言</td><td>TypeScript</td><td>5.9.3</td><td>类型约束和工程化。</td></tr>
      <tr><td>UI</td><td>Ant Design Vue</td><td>4.2.6</td><td>后台页面组件库。</td></tr>
      <tr><td>状态</td><td>Pinia</td><td>2.1.7</td><td>用户、权限、应用配置、页面状态。</td></tr>
      <tr><td>路由</td><td>Vue Router</td><td>4.5.1</td><td>路由守卫、动态路由、菜单联动。</td></tr>
      <tr><td>HTTP</td><td>Axios</td><td>1.12.2</td><td>API 请求、上传、错误处理。</td></tr>
      <tr><td>表格</td><td>vxe-table / vxe-pc-ui</td><td>4.x</td><td>复杂表格和低代码表格。</td></tr>
      <tr><td>图表</td><td>ECharts</td><td>5.6.0</td><td>大屏、统计和可视化。</td></tr>
      <tr><td>微前端</td><td>vite-plugin-qiankun</td><td>1.0.15</td><td>作为乾坤子应用或承载子应用。</td></tr>
    </table>
    <h3>推荐生产版本基线</h3>
    <p>
      <span class="tag">JDK 17 LTS</span>
      <span class="tag">Node.js 20 LTS</span>
      <span class="tag">pnpm</span>
      <span class="tag">MySQL 8.0+</span>
      <span class="tag">Redis 7.x</span>
      <span class="tag">PostgreSQL 15+ / pgvector</span>
      <span class="tag">Nginx 反向代理</span>
      <span class="tag">容器化部署</span>
    </p>
  </section>

  <section class="page-break">
    <h2>11. 生产化治理建议</h2>
    <table>
      <tr><th>优先级</th><th>事项</th><th>说明</th></tr>
      <tr><td>P0</td><td>密钥和密码外置</td><td>数据库密码、JWT Secret、短信、OSS、AI Key、Druid 账号等必须进入环境变量、配置中心密文或部署平台 Secret。</td></tr>
      <tr><td>P0</td><td>剥离演示和测试能力</td><td>生产构建、菜单、初始化数据不包含 demo/test 示例接口、示例表和历史日志。</td></tr>
      <tr><td>P0</td><td>权限与数据权限复核</td><td>用户、角色、租户、部门、菜单、按钮、报表、OpenAPI、AI/RAG 知识库都要有明确授权边界。</td></tr>
      <tr><td>P0</td><td>报表和低代码安全模式</td><td>生产低代码切换发布态，限制动态 SQL、外部数据源、敏感字段导出和未授权预览。</td></tr>
      <tr><td>P1</td><td>数据库变更管理</td><td>启用 Flyway 或 Liquibase，把大 SQL 拆为结构、基础数据、版本增量和演示数据。</td></tr>
      <tr><td>P1</td><td>日志与审计分层</td><td>普通操作日志、登录日志、OpenAPI 调用、报表导出、AI 工具调用分开留存和检索。</td></tr>
      <tr><td>P1</td><td>前端构建治理</td><td>统一 pnpm；恢复可控 tree-shaking；对报表、AI、编辑器等重依赖做按需加载。</td></tr>
      <tr><td>P2</td><td>微服务后置拆分</td><td>先稳定单体，后续按 AI/RAG、OpenAPI、任务调度、报表导出等资源消耗拆分。</td></tr>
    </table>
  </section>

  <section class="page-break">
    <h2>12. 后续建设路线</h2>
    <table>
      <tr><th>阶段</th><th>目标</th><th>交付物</th></tr>
      <tr><td>第一阶段：平台可控</td><td>完成基础配置治理、生产 profile、数据库初始化脚本清理、demo/test 剥离。</td><td>生产部署清单、配置模板、初始化 SQL 分层、权限清单。</td></tr>
      <tr><td>第二阶段：业务接入</td><td>按信息中心管理流程接入真实业务模块、报表和低代码页面。</td><td>业务模块包结构、接口规范、报表开发规范、数据权限样例。</td></tr>
      <tr><td>第三阶段：AI/RAG 受控上线</td><td>建立知识库权限、模型配置、向量库、工具调用白名单和审计机制。</td><td>AI/RAG 运维手册、模型 Key 管理、提示词版本规范、审计报表。</td></tr>
      <tr><td>第四阶段：可观测与弹性</td><td>完善日志、指标、告警、备份恢复；评估是否拆分服务。</td><td>监控大盘、告警规则、备份恢复演练、微服务拆分评估报告。</td></tr>
    </table>
    <div class="note">
      <strong>结论：</strong>Miiow Center 具备作为信息中心项目管理和低代码交付平台的基础，但生产推进时应先做“减法”和“治理”：剥离演示能力、收紧权限、管理配置密钥、拆分数据库脚本、规范报表与 AI/RAG 使用边界。微服务能力可保留，但不应成为第一阶段的复杂度来源。
    </div>
    <p class="muted">参考本地文件：<code>docs/analysis/architecture-design.md</code>、<code>docs/analysis/technology-stack.md</code>、<code>docs/analysis/database-structure.md</code>、<code>jeecg-boot/pom.xml</code>、<code>jeecgboot-vue3/package.json</code>。</p>
  </section>
</body>
</html>
''',
        encoding="utf-8",
    )


if __name__ == "__main__":
    write_html()
    print(HTML_PATH)
