from pathlib import Path


OUT_DIR = Path("/Users/t/Documents/miiow_center/docs/analysis")
HTML_PATH = OUT_DIR / "miiow-center-architecture-techstack-plan-comprehensive.html"


CSS = r"""
@page { size: A4; margin: 13mm 12mm 15mm; }
* { box-sizing: border-box; }
body {
  margin: 0;
  color: #172033;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", Arial, sans-serif;
  font-size: 12.5px;
  line-height: 1.58;
  background: #fff;
}
h1, h2, h3 { margin: 0; color: #101827; font-weight: 760; letter-spacing: 0; }
h1 { font-size: 27px; line-height: 1.24; }
h2 { margin-top: 20px; padding-bottom: 6px; border-bottom: 2px solid #d8dee9; font-size: 19px; }
h3 { margin-top: 14px; font-size: 15px; }
p { margin: 7px 0; }
ul, ol { margin: 6px 0 11px 19px; padding: 0; }
li { margin: 3px 0; }
table { width: 100%; margin: 9px 0 13px; border-collapse: collapse; table-layout: fixed; }
th, td { padding: 6px 7px; border: 1px solid #d8dee9; vertical-align: top; word-break: break-word; }
th { color: #111827; background: #eef2f7; font-weight: 700; }
code { padding: 1px 4px; border-radius: 4px; color: #27364f; background: #eef2f7; font-family: "SFMono-Regular", Consolas, monospace; font-size: 10.5px; }
.cover { min-height: 253mm; padding-top: 30mm; page-break-after: always; }
.cover-title { width: 88%; border-left: 8px solid #1b4d89; padding: 14px 0 16px 22px; }
.cover-subtitle { margin-top: 16px; color: #526173; font-size: 15px; }
.meta { margin-top: 30px; width: 76%; border-top: 1px solid #cfd7e3; padding-top: 13px; color: #526173; font-size: 12.5px; }
.toc ol { columns: 2; column-gap: 28px; }
.page-break { page-break-before: always; }
.avoid { page-break-inside: avoid; }
.note { margin: 10px 0; padding: 8px 10px; border-left: 4px solid #1b4d89; background: #f5f8fc; }
.warn { border-left-color: #b45309; background: #fff7ed; }
.danger { border-left-color: #b91c1c; background: #fff1f2; }
.diagram { margin: 10px 0 14px; padding: 11px; border: 1px solid #d8dee9; background: #fbfcfe; page-break-inside: avoid; }
.diagram-title { margin-bottom: 8px; color: #334155; font-weight: 700; }
.layer { display: grid; grid-template-columns: 92px 1fr; gap: 8px; margin: 7px 0; }
.layer-name { padding: 8px; border: 1px solid #bcc9d8; background: #e7edf5; font-weight: 700; text-align: center; }
.items { display: grid; grid-template-columns: repeat(4, 1fr); gap: 7px; }
.items.three { grid-template-columns: repeat(3, 1fr); }
.items.five { grid-template-columns: repeat(5, 1fr); }
.box { min-height: 44px; padding: 7px; border: 1px solid #b8c5d6; background: #fff; text-align: center; }
.box strong { display: block; margin-bottom: 2px; color: #15243a; }
.small { color: #5d6b7c; font-size: 10.7px; line-height: 1.36; }
.flow { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; align-items: center; }
.flow .box { min-height: 65px; position: relative; }
.flow .box:not(:last-child)::after { content: ">"; position: absolute; right: -13px; top: 21px; color: #1b4d89; font-weight: 800; }
.matrix { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.tag { display: inline-block; margin: 2px 4px 2px 0; padding: 2px 6px; border: 1px solid #cbd5e1; border-radius: 10px; background: #f8fafc; font-size: 10.5px; }
.muted { color: #64748b; }
.svg-diagram { width: 100%; height: auto; display: block; background: #fbfcfe; }
"""


def table(headers, rows, widths=None):
    if widths:
        colgroup = "<colgroup>" + "".join(f'<col style="width:{w}">' for w in widths) + "</colgroup>"
    else:
        colgroup = ""
    body = ["<table>", colgroup, "<tr>" + "".join(f"<th>{h}</th>" for h in headers) + "</tr>"]
    for row in rows:
        body.append("<tr>" + "".join(f"<td>{c}</td>" for c in row) + "</tr>")
    body.append("</table>")
    return "\n".join(body)


def layer(title, items, cls=""):
    boxes = "".join(f'<div class="box"><strong>{a}</strong><span class="small">{b}</span></div>' for a, b in items)
    return f'<div class="layer"><div class="layer-name">{title}</div><div class="items {cls}">{boxes}</div></div>'


def flow(items):
    return '<div class="flow">' + "".join(
        f'<div class="box"><strong>{a}</strong><span class="small">{b}</span></div>' for a, b in items
    ) + "</div>"


def write_html():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    html = f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>Miiow Center 架构、技术栈与项目规划详细说明</title>
  <style>{CSS}</style>
</head>
<body>
  <section class="cover">
    <div class="cover-title">
      <h1>Miiow Center<br>架构、技术栈与项目规划详细说明</h1>
      <div class="cover-subtitle">基于现有代码、配置、数据库脚本和既有 analysis 文档的综合版</div>
    </div>
    <div class="meta">
      <p><strong>项目目录：</strong><code>/Users/t/Documents/miiow_center</code></p>
      <p><strong>文档对象：</strong>信息中心管理人员、后端开发、前端开发、产品、实施和运维人员。</p>
      <p><strong>代码基线：</strong>JEECG Boot 3.9.1、Spring Boot 3.5.5、Java 17、Vue 3.5.22、Vite 6.3.6。</p>
      <p><strong>生成日期：</strong>2026-07-02</p>
      <p><strong>说明：</strong>本版把已有 <code>architecture-design.md</code>、<code>technology-stack.md</code>、<code>database-structure.md</code>、<code>code-standards.md</code>、<code>database-naming-standards.md</code> 的结论合并，并补充代码级盘点、项目阶段规划和整改建议。</p>
    </div>
  </section>

  <section class="toc page-break">
    <h2>目录</h2>
    <ol>
      <li>阅读范围与结论摘要</li>
      <li>代码与资产盘点</li>
      <li>项目定位与建设目标</li>
      <li>当前总体架构</li>
      <li>目标架构与演进路线</li>
      <li>后端代码结构详解</li>
      <li>前端代码结构详解</li>
      <li>核心业务能力域</li>
      <li>认证、权限与数据权限</li>
      <li>低代码、报表与数据源治理</li>
      <li>AI/RAG 能力治理</li>
      <li>数据架构与库表规划</li>
      <li>部署与环境规划</li>
      <li>技术栈版本基线</li>
      <li>主要问题与优化建议</li>
      <li>项目实施规划</li>
      <li>交付清单与验收标准</li>
    </ol>
  </section>

  <section class="page-break">
    <h2>1. 阅读范围与结论摘要</h2>
    <p>本次重新梳理不只看上一版 PDF，而是把项目下已有分析文档、README、后端 POM、前端 package、单体与微服务 Docker Compose、生产 profile、核心 Controller、AI/RAG 模块、前端 views/API/store、数据库初始化脚本和命名规范一起纳入判断。</p>
    {table(["材料", "已阅读/分析内容", "用于本文档的结论"], [
        ["既有架构文档", "<code>docs/analysis/architecture-design.md</code>、<code>technology-stack.md</code>", "保留“模块化单体优先、微服务后置”的结论，并补充目标架构、规划和整改路径。"],
        ["数据库分析文档", "<code>database-structure.md</code>、<code>database-naming-standards.md</code>", "确认主 SQL 约 145 张表，存在 demo/test/三方表混入主初始化脚本的问题。"],
        ["代码规范文档", "<code>code-standards.md</code>", "将 Controller/Service/Mapper/DTO/VO 分层规范写入后续业务接入标准。"],
        ["后端代码", "901 个 Java 文件、94 个 Controller、74 个 ServiceImpl、78 个 Entity、63 个 Mapper、76 个 Mapper XML", "系统模块是主体，AI/RAG 已成独立能力域，demo/test/cloud visual 占比不低，生产必须治理。"],
        ["前端代码", "769 个 Vue 文件、551 个 TypeScript 文件，<code>views/system</code>、<code>views/super/airag</code>、<code>views/demo</code> 占比较高", "前端是完整管理端和平台控制台，不是简单业务页面；生产需要菜单裁剪、路由分包和 demo 剥离。"],
        ["部署配置", "<code>docker-compose.yml</code>、<code>docker-compose-cloud.yml</code>、<code>application-prod.yml</code>", "单体和微服务都有入口；生产 profile 仍有默认密码、堆栈暴露和 AI 敏感节点等风险。"],
    ], ["19%", "39%", "42%"])}
    <div class="note">
      <strong>核心判断：</strong>Miiow Center 当前应定位为“信息中心低代码与 AI 能力中台基座”，先用模块化单体承载统一用户、权限、菜单、字典、报表、在线表单、OpenAPI 和 AI/RAG；等业务边界、访问压力和运维能力成熟后，再拆 Gateway、AI/RAG、报表导出、任务调度等独立服务。
    </div>
    <div class="note warn">
      <strong>重要差距：</strong>当前项目具备大量平台能力，但生产落地前还缺少三类工作：配置安全化、演示/测试能力剥离、平台能力使用边界。低代码、报表、AI/RAG 和 OpenAPI 都是高价值能力，也都是高风险入口。
    </div>
  </section>

  <section class="page-break">
    <h2>2. 代码与资产盘点</h2>
    <p>从代码规模看，项目不是空壳模板。后端有系统管理、OpenAPI、消息、监控、OSS、Quartz、AI/RAG、Demo、Cloud Visual 等多个域；前端有系统管理、监控、OpenAPI、AI/RAG、报表、Demo 等页面。规划时不能只写技术栈清单，需要把“哪些能力作为生产平台保留、哪些能力只作为示例剥离、哪些能力后续拆服务”明确下来。</p>
    {table(["维度", "数量/范围", "说明"], [
        ["后端 Java 文件", "901", "包含 core、system、airag、demo、server-cloud、visual、xxl-job、sentinel 等。"],
        ["后端 Controller", "94", "system 32 个，airag 10 个，openapi 5 个，demo/test/cloud visual 较多。"],
        ["ServiceImpl", "74", "system 38 个，airag 11 个，openapi 4 个，demo 7 个。"],
        ["Entity", "78", "system 38 个，airag 9 个，openapi 6 个，demo/test 若干。"],
        ["Mapper/XML", "63 个 Mapper，76 个 Mapper XML", "以 MyBatis-Plus + XML 承载复杂查询和平台表访问。"],
        ["前端 Vue", "769", "demo 页面 231 个、system 115 个、super/airag 62 个。"],
        ["前端 TypeScript", "551", "包含 API、store、router、utils、hooks、组件配置等。"],
        ["数据库脚本", "主业务 SQL + Nacos + XXL-JOB", "主脚本混合平台表、AI/RAG 表、报表表、Online 表、演示测试表和历史数据。"],
    ], ["22%", "24%", "54%"])}
    <div class="diagram">
      <div class="diagram-title">图 1：代码资产分布</div>
      {layer("后端核心", [("base-core", "公共工具、缓存、异常、权限切面"), ("system", "用户、角色、菜单、租户、字典"), ("airag", "AI 应用、知识库、模型、提示词"), ("openapi", "接口授权、日志、权限")])}
      {layer("后端扩展", [("message", "站内信、模板、发送通道"), ("quartz", "本地定时任务"), ("oss", "文件管理"), ("monitor", "Redis、内存、HTTP trace")])}
      {layer("演示/微服务", [("demo/test", "示例、测试、店铺、订单、MCP demo"), ("gateway", "微服务网关"), ("nacos", "注册与配置中心"), ("visual", "Sentinel、XXL-JOB、测试组件")])}
      {layer("前端", [("system", "用户权限与平台配置"), ("super/airag", "AI/RAG 管理界面"), ("monitor/openapi", "监控与开放接口"), ("demo", "大量示例页面")])}
    </div>
  </section>

  <section class="page-break">
    <h2>3. 项目定位与建设目标</h2>
    <p>结合 README 和代码结构，Miiow Center 最合理的项目定位不是普通后台，也不是立即全面微服务的业务系统，而是一个面向信息中心的“统一管理和低代码交付平台”。它要提供稳定的账号权限、组织租户、菜单路由、字典、报表、在线表单、OpenAPI、AI/RAG、文件、消息、调度和监控能力，支撑后续业务模块快速接入。</p>
    {table(["建设目标", "范围", "落地要求"], [
        ["统一身份与权限", "用户、角色、部门、租户、菜单、按钮、数据权限", "权限由后端统一返回和校验，前端只负责展示控制。"],
        ["统一平台配置", "字典、分类、校验规则、填值规则、文件、消息、首页配置", "由信息中心维护，业务模块按规范复用。"],
        ["低代码交付", "Online 表单、Online 报表、JimuReport、大屏、数据源", "开发态和生产态严格隔离，生产禁止任意 SQL 和无授权导出。"],
        ["AI/RAG 服务", "模型、知识库、提示词、AI 应用、OCR、Word 模板、MCP", "按知识库、工具、模型和调用日志做权限与审计。"],
        ["开放接口", "OpenAPI 授权、调用日志、权限配置", "用于对接外部系统，不替代内部 Controller 权限。"],
        ["可运维平台", "日志、监控、任务、备份、配置、部署", "先单体稳定，再根据资源隔离诉求拆服务。"],
    ], ["22%", "34%", "44%"])}
    <div class="note">
      <strong>边界原则：</strong>平台能力留在 system/airag/openapi/report/online 等域；真实业务系统不要继续写进 demo/test，也不要把业务逻辑塞进 common/base-core。新业务建议单独建 Maven 模块或至少独立 <code>org.jeecg.modules.&lt;business&gt;</code> 包。
    </div>
  </section>

  <section class="page-break">
    <h2>4. 当前总体架构</h2>
    <p>当前工程具备前后端分离、模块化后端、单体启动、微服务启动、低代码、报表、AI/RAG、OpenAPI 和调度能力。前端通过后端权限模式加载菜单路由；后端通过 Shiro/JWT 做登录授权，通过 MyBatis-Plus 访问主库，通过 Redis 做缓存和 Token，通过 PostgreSQL/pgvector 支撑 AI/RAG 向量库，通过 OSS/MinIO/local 管理附件。</p>
    <div class="diagram">
      <div class="diagram-title">图 2：当前总体架构</div>
      {layer("用户入口", [("管理员", "权限、菜单、租户、配置"), ("开发人员", "业务模块、接口、低代码增强"), ("产品/实施", "表单、报表、知识库配置"), ("外部系统", "OpenAPI、SSO、消息")])}
      {layer("前端管理端", [("Vue3 + Vite", "TypeScript、Ant Design Vue"), ("动态路由", "BACK 权限模式"), ("平台页面", "system、monitor、openapi"), ("AI 页面", "super/airag")])}
      {layer("后端接口", [("单体启动", "jeecg-system-start，8080"), ("认证授权", "Shiro、JWT、数据权限"), ("接口文档", "Knife4j / Swagger"), ("微服务入口", "Gateway、Nacos 可选")])}
      {layer("业务能力", [("系统管理", "用户、角色、菜单、租户"), ("低代码/报表", "Online、JimuReport、数据源"), ("AI/RAG", "模型、知识库、应用、提示词"), ("调度消息", "Quartz、XXL-JOB、站内信")])}
      {layer("基础设施", [("MySQL", "主业务库和平台元数据"), ("Redis", "缓存、Token、锁"), ("PostgreSQL", "AI 向量库"), ("对象存储", "local、MinIO、OSS")])}
    </div>
    <h3>当前架构的实际特点</h3>
    <ul>
      <li>后端以 <code>jeecg-module-system</code> 为平台主体，系统管理域占代码主体。</li>
      <li><code>jeecg-boot-module-airag</code> 已经形成独立 AI/RAG 能力域，但部分接口使用 <code>@IgnoreAuth</code>，生产要审慎复核。</li>
      <li><code>jeecg-module-demo</code> 和 <code>views/demo</code> 示例内容较多，适合学习，不适合直接进入生产菜单和生产镜像。</li>
      <li><code>jeecg-server-cloud</code> 提供微服务能力，但从当前业务边界看不应一开始就全面启用。</li>
    </ul>
  </section>

  <section class="page-break">
    <h2>5. 目标架构与演进路线</h2>
    <p>目标架构建议分两层理解：第一阶段是“生产可控的模块化单体”，第二阶段才是“按能力拆分的服务化平台”。这样能避免在权限、数据、报表、AI/RAG 还没治理好时，把复杂度提前推给 Nacos、Gateway、链路追踪和多服务部署。</p>
    <div class="diagram">
      <div class="diagram-title">图 3：目标演进架构</div>
      <svg class="svg-diagram" viewBox="0 0 980 520" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <marker id="arr" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#1b4d89"/></marker>
          <style>.g{{fill:#f5f8fc;stroke:#c7d2df;stroke-width:1.2}}.n{{fill:#fff;stroke:#9fb0c3;stroke-width:1.4}}.s{{fill:#edf6f2;stroke:#8ab8a0;stroke-width:1.4}}.t{{font:700 14px sans-serif;fill:#15243a}}.x{{font:12px sans-serif;fill:#405166}}.l{{stroke:#1b4d89;stroke-width:1.5;marker-end:url(#arr)}} </style>
        </defs>
        <rect x="26" y="34" width="930" height="450" rx="6" class="g"/>
        <text x="50" y="66" class="t">阶段一：模块化单体生产架构</text>
        <rect x="72" y="110" width="150" height="70" rx="5" class="n"/><text x="112" y="140" class="t">Nginx</text><text x="94" y="162" class="x">HTTPS / 静态资源</text>
        <rect x="292" y="110" width="170" height="70" rx="5" class="n"/><text x="331" y="140" class="t">Vue3 管理端</text><text x="318" y="162" class="x">权限路由 / 平台页面</text>
        <rect x="532" y="96" width="190" height="98" rx="5" class="n"/><text x="578" y="128" class="t">后端单体</text><text x="554" y="152" class="x">system + airag + openapi</text><text x="554" y="174" class="x">report + online + job</text>
        <rect x="770" y="66" width="132" height="54" rx="5" class="s"/><text x="812" y="98" class="t">MySQL</text>
        <rect x="770" y="140" width="132" height="54" rx="5" class="s"/><text x="814" y="172" class="t">Redis</text>
        <rect x="770" y="214" width="132" height="54" rx="5" class="s"/><text x="792" y="246" class="t">PG Vector</text>
        <rect x="770" y="288" width="132" height="54" rx="5" class="s"/><text x="798" y="320" class="t">MinIO/OSS</text>
        <line x1="222" y1="145" x2="292" y2="145" class="l"/><line x1="462" y1="145" x2="532" y2="145" class="l"/>
        <line x1="722" y1="145" x2="770" y2="94" class="l"/><line x1="722" y1="145" x2="770" y2="167" class="l"/><line x1="722" y1="145" x2="770" y2="241" class="l"/><line x1="722" y1="145" x2="770" y2="315" class="l"/>
        <text x="50" y="390" class="t">阶段二：按能力拆分服务</text>
        <rect x="72" y="414" width="130" height="48" rx="5" class="n"/><text x="106" y="444" class="t">Gateway</text>
        <rect x="242" y="414" width="130" height="48" rx="5" class="n"/><text x="270" y="444" class="t">System</text>
        <rect x="412" y="414" width="130" height="48" rx="5" class="n"/><text x="444" y="444" class="t">AI/RAG</text>
        <rect x="582" y="414" width="130" height="48" rx="5" class="n"/><text x="618" y="444" class="t">Report</text>
        <rect x="752" y="414" width="130" height="48" rx="5" class="n"/><text x="792" y="444" class="t">Job</text>
        <line x1="202" y1="438" x2="242" y2="438" class="l"/>
        <line x1="372" y1="438" x2="412" y2="438" class="l"/>
        <line x1="542" y1="438" x2="582" y2="438" class="l"/>
        <line x1="712" y1="438" x2="752" y2="438" class="l"/>
      </svg>
    </div>
    {table(["阶段", "架构形态", "拆分条件", "不建议提前做的事"], [
        ["阶段一", "模块化单体 + 独立数据库/缓存/对象存储", "默认推进方式；先治理配置、权限、脚本、日志和菜单", "不急于拆服务，不急于引入复杂链路治理。"],
        ["阶段二", "AI/RAG 独立服务或独立部署", "模型调用耗时、向量库负载、文件解析任务明显影响主后台", "不要让 AI 工具调用和主业务共享无边界权限。"],
        ["阶段三", "报表/导出/任务独立服务", "大报表导出、定时任务、批处理影响在线请求", "不要把导出任务继续同步阻塞在主应用。"],
        ["阶段四", "Gateway + Nacos + Sentinel 完整微服务", "团队具备多服务发布、监控、排障和容量治理能力", "不要为“架构先进”而拆分。"],
    ], ["16%", "32%", "31%", "21%"])}
  </section>

  <section class="page-break">
    <h2>6. 后端代码结构详解</h2>
    <p>后端遵循 JEECG 多模块和 Controller-Service-Mapper 分层。现有代码里 system 是平台核心，airag 是新增 AI 能力域，openapi 是外部接口域，demo/test 是示例域，cloud/visual 是可选微服务与治理组件。</p>
    {table(["模块/包", "代码现状", "规划建议"], [
        ["<code>jeecg-boot-base-core</code>", "公共 API、异常、缓存、字典、权限切面、查询构造、上传下载等。", "只放跨模块基础能力，禁止继续下沉具体业务逻辑。"],
        ["<code>jeecg-module-system</code>", "平台核心：用户、角色、菜单、部门、租户、字典、日志、消息、OSS、Quartz、OpenAPI。", "作为平台治理核心保留；新业务不得塞入 system。"],
        ["<code>jeecg-boot-module-airag</code>", "AI 应用、聊天、知识库、模型、MCP、OCR、提示词、Word 模板。", "作为独立业务域治理；后续可独立部署。"],
        ["<code>jeecg-module-demo</code>", "店铺、订单、MCP、Online 增强、Mock、测试接口。", "生产剥离，菜单禁用，必要时独立 demo profile。"],
        ["<code>jeecg-server-cloud</code>", "Gateway、Nacos、System Cloud、Demo Cloud、Sentinel、XXL-JOB、测试组件。", "保留为演进选项；生产一期不建议全面启用。"],
    ], ["26%", "39%", "35%"])}
    <h3>后端开发分层要求</h3>
    <ul>
      <li>Controller：只做参数绑定、权限注解、基础校验和 Result 返回，不写复杂业务，不直接访问 Mapper。</li>
      <li>Service/ServiceImpl：承载事务、跨表业务、状态流转、审计日志和外部系统调用编排。</li>
      <li>Mapper/XML：只做数据访问；复杂查询显式列名；分页必须稳定排序；用户输入必须参数绑定。</li>
      <li>DTO/VO：新业务不要直接把 Entity 暴露给前端，尤其是用户、租户、AI 配置、密钥和数据源对象。</li>
      <li>跨模块调用：优先走 API 抽象或领域 Service，不直接跨包访问对方 Mapper。</li>
    </ul>
    <div class="diagram">
      <div class="diagram-title">图 4：后端请求分层</div>
      {flow([("Controller", "接口入口、权限、参数"), ("Service", "业务动作和事务"), ("Mapper/XML", "数据库访问"), ("Cache/OSS/AI", "Redis、文件、模型服务"), ("Audit", "日志、审计、异常")])}
    </div>
  </section>

  <section class="page-break">
    <h2>7. 前端代码结构详解</h2>
    <p>前端是完整的管理端平台，采用 Vue3、TypeScript、Vite、Ant Design Vue、Pinia、Vue Router、Axios、ECharts、vxe-table 和 qiankun。权限模式为 BACK，即菜单、动态路由和按钮权限由后端返回。</p>
    {table(["目录/能力", "现状", "规划建议"], [
        ["<code>src/views/system</code>", "用户、角色、菜单、部门、租户、字典、消息、文件、白名单等平台页面。", "作为信息中心配置台保留，但生产只给管理员和授权角色。"],
        ["<code>src/views/super/airag</code>", "AI 应用、知识库、模型、MCP、提示词、OCR、Word 模板等页面。", "单独做菜单分组、角色授权和审计入口。"],
        ["<code>src/views/monitor</code>", "日志、Redis、数据源、磁盘、路由、任务、trace。", "生产只开放给运维角色；敏感接口隐藏并服务端鉴权。"],
        ["<code>src/views/openapi</code>", "开放接口管理和 Swagger UI。", "调用方、授权、日志和接口状态要纳入上线审批。"],
        ["<code>src/views/demo</code>", "231 个 Vue 页面，覆盖组件、表格、文档、权限、功能演示。", "生产构建或菜单中剥离；保留到开发环境即可。"],
        ["<code>src/utils/http/axios</code>", "统一请求封装、Token、URL 前缀、上传地址和错误处理。", "新增业务 API 统一封装，不在页面散写 URL。"],
    ], ["27%", "36%", "37%"])}
    <div class="diagram">
      <div class="diagram-title">图 5：前端运行链路</div>
      {flow([("登录页", "用户名、验证码、Token"), ("用户信息", "字典、首页、角色"), ("权限路由", "后端菜单转前端路由"), ("页面组件", "system、airag、report"), ("API 请求", "Axios、上传、错误处理")])}
    </div>
    <h3>前端优化方向</h3>
    <ul>
      <li>统一 pnpm，不在脚本里混用 npm；README 已提示 Node 20+ 和 pnpm 9+。</li>
      <li>对 demo、编辑器、报表、AI 聊天、可视化大屏等重模块做路由级懒加载和分包。</li>
      <li>新增业务页面按 <code>views/&lt;domain&gt;/&lt;feature&gt;</code> 组织，API 放到对应 <code>*.api.ts</code>。</li>
      <li>生产环境 <code>VITE_GLOB_DOMAIN_URL</code> 不应指向 localhost，应由 Nginx/网关统一代理。</li>
    </ul>
  </section>

  <section class="page-break">
    <h2>8. 核心业务能力域</h2>
    <p>从代码和数据库看，系统可划分为八个能力域。每个域都需要明确“保留、限制、剥离或后续拆分”的策略。</p>
    {table(["能力域", "主要代码/页面/表", "生产策略"], [
        ["系统权限域", "LoginController、SysUser、SysRole、SysPermission、<code>sys_*</code>", "核心保留；强化密码、Token、会话、角色、按钮和数据权限。"],
        ["组织租户域", "SysDepart、SysTenant、SysUserTenant、部门角色", "核心保留；按信息中心组织模型梳理租户和部门边界。"],
        ["配置字典域", "SysDict、SysCategory、SysCheckRule、SysFillRule", "核心保留；作为业务模块复用的基础配置。"],
        ["低代码域", "Online 表单、<code>onl_*</code>、@jeecg/online", "保留但强治理；生产发布态，开发态仅限授权人员。"],
        ["报表域", "JimuReport、<code>jimu_*</code>、<code>rep_*</code>", "保留；报表数据源、导出、敏感字段和分享链接必须审计。"],
        ["AI/RAG 域", "airag 模块、<code>airag_*</code>、<code>aigc_*</code>", "重点建设；模型、知识库、工具调用和向量库隔离。"],
        ["开放接口域", "openapi 模块、<code>open_api*</code>", "按调用方授权；访问日志和频控必须启用。"],
        ["演示测试域", "demo/test Java、views/demo、rep_demo/test 表", "生产剥离；开发保留。"],
    ], ["20%", "42%", "38%"])}
  </section>

  <section class="page-break">
    <h2>9. 认证、权限与数据权限</h2>
    <p>登录链路由 <code>/sys/login</code> 处理，包含验证码、失败次数锁定、密码校验、JWT 生成、Redis 缓存和登录日志。前端通过 <code>/sys/user/getUserInfo</code> 获取用户信息和字典，通过 <code>/sys/permission/getUserPermissionByToken</code> 获取后端授权菜单并生成路由。</p>
    <div class="diagram">
      <div class="diagram-title">图 6：登录、菜单与接口鉴权链路</div>
      {flow([("登录", "验证码、密码、失败锁定"), ("Token", "JWT + Redis 缓存"), ("用户信息", "用户、字典、首页"), ("菜单权限", "角色菜单、按钮权限"), ("接口校验", "Shiro、RequiresPermissions、数据权限")])}
    </div>
    {table(["控制点", "当前依据", "优化建议"], [
        ["密码和登录", "LoginController 已有失败次数限制、验证码和日志。", "检查密码策略、默认 admin 密码、验证码有效期、登录失败告警。"],
        ["Token 与会话", "JWT + Redis Token 缓存，多端登录配置 <code>is-concurrent</code>。", "生产明确是否允许多地登录；退出和密码变更时清理全部端 Token。"],
        ["菜单权限", "SysPermissionController 动态返回用户菜单。", "把 demo、monitor、openapi、airag 等菜单按角色严格分组。"],
        ["接口权限", "部分接口有 <code>@RequiresPermissions</code>，AI Chat 多处 <code>@IgnoreAuth</code>。", "逐个复核 IgnoreAuth，聊天、上传、会话、知识库接口不应默认匿名开放。"],
        ["数据权限", "已有数据权限切面、租户字段和部门角色。", "AI 知识库、报表数据源、OpenAPI 调用方都要纳入租户/部门/角色边界。"],
    ], ["19%", "37%", "44%"])}
  </section>

  <section class="page-break">
    <h2>10. 低代码、报表与数据源治理</h2>
    <p>低代码和报表是平台的高价值能力，但也是生产风险最高的入口之一。生产 profile 已有 <code>jeecg.firewall.dataSourceSafe: true</code>、<code>lowCodeMode: prod</code>、<code>jmreport.firewall.lowCodeMode: prod</code>，方向正确；但仍需要把角色、数据源、SQL、导出和分享链接治理落到流程。</p>
    {table(["对象", "风险", "治理建议"], [
        ["Online 表单", "在线设计可能改变表结构、字段、校验和页面行为。", "开发态配置，测试验证，生产发布态；变更记录和回滚方案必须保留。"],
        ["Online 报表/JimuReport", "SQL 数据集、API 数据集、导出、打印、分享链接可能绕过业务权限。", "报表上线审批；查询条件强制绑定用户/租户/部门；导出单独授权。"],
        ["数据源管理", "多数据源如果可在线配置，可能连接生产敏感库。", "数据源白名单；只读账号；连接信息加密；高风险库禁止在线配置。"],
        ["大屏/可视化", "外部分享和匿名预览容易造成数据泄露。", "分享链接过期、带权限校验、记录访问日志。"],
        ["演示报表", "<code>rep_demo_*</code> 和历史示例数据混在主脚本。", "生产初始化脚本移除示例表和示例菜单。"],
    ], ["22%", "36%", "42%"])}
    <div class="diagram">
      <div class="diagram-title">图 7：低代码发布流程</div>
      {flow([("需求确认", "表单/报表边界"), ("开发态配置", "Online/Jimu 设计"), ("测试验证", "权限、SQL、导出"), ("发布态上线", "prod 模式"), ("审计归档", "访问、导出、变更")])}
    </div>
  </section>

  <section class="page-break">
    <h2>11. AI/RAG 能力治理</h2>
    <p>AI/RAG 模块包含 AI 应用、聊天、知识库、模型、MCP、OCR、提示词、Word 模板。它已经不是简单“AI 聊天入口”，而是需要单独权限、资源和审计的业务域。当前生产配置中 <code>jeecg.ai-rag.allow-sensitive-nodes: sql,stdio</code> 风险较高，必须在正式上线前改为默认关闭或白名单审批。</p>
    <div class="diagram">
      <div class="diagram-title">图 8：AI/RAG 目标治理架构</div>
      {flow([("知识接入", "文档、FAQ、模板"), ("解析入库", "OCR、切分、Embedding"), ("权限过滤", "租户、部门、角色、知识库"), ("检索生成", "召回、提示词、模型"), ("审计反馈", "问题、召回片段、输出、成本")])}
    </div>
    {table(["治理点", "当前代码/配置体现", "整改建议"], [
        ["模型配置", "<code>airag_model</code>、<code>jeecg.ai-chat</code>", "模型 Key 全部密文配置；不同环境使用不同模型和额度。"],
        ["知识库权限", "<code>AiragKnowledgeController</code> 已有部分租户删除校验。", "查询、检索、文档导入、重建都要统一做租户/部门/角色过滤。"],
        ["聊天接口", "<code>AiragChatController</code> 多处 <code>@IgnoreAuth</code>。", "匿名访问只保留明确公开应用；上传、会话、历史消息默认要求认证。"],
        ["工具调用", "配置允许 <code>sql,stdio</code> 敏感节点。", "生产默认空白名单；按工具登记、审批、参数限制、执行日志和回滚方案启用。"],
        ["向量库", "PostgreSQL/pgvector 配置存在。", "独立库、独立账号、按知识库元数据隔离，定期清理孤儿向量。"],
        ["成本审计", "当前文档未形成成本治理。", "记录模型、Token、耗时、用户、应用、知识库和输出摘要。"],
    ], ["19%", "36%", "45%"])}
  </section>

  <section class="page-break">
    <h2>12. 数据架构与库表规划</h2>
    <p>数据库当前混合了平台表、低代码表、报表表、AI/RAG 表、OpenAPI 表、Quartz 表、Nacos 表、XXL-JOB 表、demo/test 表和历史日志。短期可以不重命名 JEECG 平台表，但必须明确分层和初始化策略。</p>
    <div class="diagram">
      <div class="diagram-title">图 9：目标数据库分层</div>
      {layer("主业务库", [("sys_*", "用户、角色、菜单、租户、字典"), ("onl_*", "Online 表单和报表"), ("jimu_*", "积木报表元数据"), ("open_api*", "开放接口授权和日志")])}
      {layer("AI 数据", [("airag_*", "AI 应用和知识库"), ("aigc_*", "Word 模板"), ("pgvector", "向量索引"), ("对象存储", "原文档、图片、附件")])}
      {layer("独立组件库", [("nacos", "配置中心原生表"), ("xxl_job", "任务调度中心表"), ("qrtz_*", "Quartz 表"), ("flyway", "迁移历史表")])}
      {layer("剥离对象", [("demo/test", "演示测试表"), ("rep_demo_*", "示例报表表"), ("历史日志", "不进初始化"), ("示例菜单", "生产禁用")])}
    </div>
    {table(["脚本类型", "内容", "建议文件"], [
        ["schema", "表结构、索引、约束、必要注释", "V1__schema.sql"],
        ["seed", "基础角色、菜单、字典、租户、系统配置", "V2__seed_platform.sql"],
        ["feature", "AI/RAG、OpenAPI、报表等能力的可选初始化", "V3__feature_airag.sql 等"],
        ["demo-data", "示例表、示例菜单、示例报表、Mock 数据", "仅开发环境执行，不进入生产"],
        ["third-party", "Nacos、XXL-JOB、Quartz 原生脚本", "独立库或独立 schema，不强制改名"],
    ], ["20%", "43%", "37%"])}
  </section>

  <section class="page-break">
    <h2>13. 部署与环境规划</h2>
    <p>项目已有单体 Docker Compose 和微服务 Docker Compose。生产一期推荐使用单体 Compose 或容器编排，但数据库、Redis、PG Vector、对象存储应独立管理；微服务 Compose 可作为后续拆分参考。</p>
    {table(["环境", "部署形态", "关键配置"], [
        ["本地开发", "前端 Vite dev + 后端单体 + MySQL/Redis/PG 容器", "允许 lowCode dev；使用开发密钥；保留 demo。"],
        ["测试环境", "Nginx + 前端 dist + 后端单体 + 独立基础设施", "关闭匿名高风险接口；验证 prod 配置；导入准生产数据。"],
        ["生产一期", "Nginx + 前端静态资源 + 后端单体 + MySQL/Redis/PG/OSS", "密钥外置、demo 剥离、报表/AI 权限、日志监控备份。"],
        ["生产二期", "Gateway + System + AI/RAG + Report/Job 分服务", "Nacos、Sentinel、链路追踪、服务监控、灰度发布。"],
    ], ["18%", "35%", "47%"])}
    <div class="note warn">
      <strong>部署配置风险：</strong><code>docker-compose.yml</code> 中 MySQL root/root、PostgreSQL postgres/postgres 只能用于开发；生产必须改用独立 Secret、私有网络、备份策略和最小权限账号。
    </div>
  </section>

  <section class="page-break">
    <h2>14. 技术栈版本基线</h2>
    {table(["层级", "技术", "当前版本/配置", "建议"], [
        ["后端语言", "Java", "17", "生产统一 JDK 17 LTS；后续评估 21。"],
        ["后端框架", "Spring Boot", "3.5.5", "保持当前基线，升级前先做依赖兼容测试。"],
        ["微服务", "Spring Cloud / Alibaba", "2025.0.0 / 2023.0.3.3", "仅二期启用完整治理。"],
        ["ORM", "MyBatis-Plus", "3.5.12", "复杂查询继续使用 XML，但要统一 SQL 规范。"],
        ["权限", "Shiro / java-jwt", "2.0.5 / 4.5.0", "补齐接口权限和 Token 治理。"],
        ["报表", "JimuReport", "2.3.0", "生产发布态，导出和分享单独授权。"],
        ["前端", "Vue / Vite / TS", "3.5.22 / 6.3.6 / 5.9.3", "Node 20+，pnpm 9+。"],
        ["UI", "Ant Design Vue", "4.2.6", "后台组件主线保持一致。"],
        ["数据库", "MySQL、Redis、PostgreSQL/pgvector", "MySQL 脚本 5.7 风格，推荐 MySQL 8", "生产 MySQL 8、Redis 7、PG 15+。"],
        ["对象存储", "local、MinIO、OSS、七牛", "配置支持多种", "生产优先 MinIO/OSS，禁止本地单点。"],
    ], ["18%", "24%", "28%", "30%"])}
  </section>

  <section class="page-break">
    <h2>15. 主要问题与优化建议</h2>
    <p>下面不是泛泛建议，而是按实际代码和配置整理的整改清单。P0 是生产前必须处理，P1 是首轮上线后一个迭代内处理，P2 是中长期优化。</p>
    {table(["优先级", "问题", "依据", "整改建议"], [
        ["P0", "生产错误堆栈暴露", "<code>application-prod.yml</code> 中 <code>include-stacktrace: ALWAYS</code>", "生产改为 never/on_param；前端返回统一错误码，详细堆栈只进服务端日志。"],
        ["P0", "默认管理账号密码", "Druid <code>admin/123456</code>、Knife4j <code>jeecg/jeecg1314</code>", "关闭公网访问或改为密文强密码；仅内网/运维角色可访问。"],
        ["P0", "数据库和 PG 默认密码", "Compose 中 root/root、postgres/postgres", "生产使用 Secret；最小权限账号；禁止暴露数据库端口到公网。"],
        ["P0", "AI 敏感节点默认允许", "<code>allow-sensitive-nodes: sql,stdio</code>", "生产默认禁用；按工具白名单审批和审计。"],
        ["P0", "AI Chat 匿名接口偏多", "<code>AiragChatController</code> 多处 <code>@IgnoreAuth</code>", "逐个确认公开场景；上传、会话、历史消息默认要求登录和应用授权。"],
        ["P0", "demo/test 示例能力混入", "后端 demo/test Controller、前端 views/demo、SQL demo/test/rep_demo", "生产构建、菜单和初始化脚本剥离。"],
        ["P1", "Flyway 禁用且大 SQL 初始化", "<code>spring.flyway.enabled: false</code>", "启用迁移管理；拆 schema/seed/demo/third-party。"],
        ["P1", "日志表和运行数据缺少归档", "<code>sys_log</code>、<code>open_api_log</code>、AI 调用日志", "设计保留周期、归档表、分区或定期清理任务。"],
        ["P1", "前端 demo 和重依赖影响包体", "views/demo 231 个 Vue 页面，编辑器/报表/AI 依赖多", "生产菜单裁剪、路由懒加载、分包分析。"],
        ["P1", "报表和数据源治理不足", "Online/JimuReport 具备在线 SQL/数据源能力", "数据源白名单、只读账号、导出审批、敏感字段脱敏。"],
        ["P2", "业务模块边界未建立", "当前主要是平台基座，真实业务模块未独立规划", "新业务按领域建 Maven 模块和前端 views/domain。"],
        ["P2", "微服务治理后置", "cloud 组件完整但边界未成熟", "等 AI/报表/Job 资源隔离需求明确后再拆。"],
    ], ["9%", "25%", "32%", "34%"])}
  </section>

  <section class="page-break">
    <h2>16. 项目实施规划</h2>
    <p>建议把项目规划拆为 6 个阶段，每阶段都有明确产物。这样信息中心、开发、产品和运维可以按里程碑推进，而不是一次性把所有 JEECG 能力都打开。</p>
    {table(["阶段", "周期建议", "目标", "主要任务", "交付物"], [
        ["0. 现状冻结", "1 周", "冻结基线和风险清单", "确认分支、版本、部署方式、启用模块、禁用 demo 范围", "基线说明、风险清单、模块启停清单"],
        ["1. 生产可控", "2 周", "先能安全部署", "配置密钥外置、关闭堆栈、改默认密码、剥离 demo/test、整理初始化脚本", "prod profile、Secret 模板、精简 SQL、生产菜单"],
        ["2. 平台治理", "2 周", "信息中心可管理", "用户角色、部门租户、菜单权限、字典、文件、消息、日志归档", "权限矩阵、运维手册、日志策略"],
        ["3. 业务接入", "2-4 周", "接入首批业务模块", "新业务包结构、前端页面规范、接口规范、数据权限样例", "业务模块模板、接口清单、测试用例"],
        ["4. 报表低代码", "2 周", "规范报表交付", "数据源白名单、报表审批、导出权限、发布态流程", "报表开发规范、数据源台账、导出审计"],
        ["5. AI/RAG 上线", "2-3 周", "受控开放 AI 能力", "知识库权限、模型 Key、向量库、工具白名单、成本审计", "AI 运维手册、知识库权限矩阵、审计报表"],
        ["6. 服务化评估", "持续", "决定是否拆服务", "监控容量、慢接口、任务负载、AI/报表资源占用", "拆分评估报告、二期架构方案"],
    ], ["10%", "11%", "17%", "34%", "28%"])}
    <div class="diagram">
      <div class="diagram-title">图 10：实施路线</div>
      {flow([("基线冻结", "代码、配置、模块清单"), ("安全生产", "密钥、demo、SQL、权限"), ("平台治理", "用户、菜单、租户、日志"), ("能力上线", "业务、报表、AI/RAG"), ("服务演进", "监控驱动拆分")])}
    </div>
  </section>

  <section class="page-break">
    <h2>17. 交付清单与验收标准</h2>
    {table(["交付项", "验收标准"], [
        ["架构文档", "包含当前架构、目标架构、模块边界、部署拓扑、数据域、AI/RAG、低代码和优化建议。"],
        ["技术栈文档", "版本基线、运行要求、升级策略、依赖边界、前后端开发规范清楚。"],
        ["生产配置模板", "无默认密码、无真实密钥、无堆栈暴露、profile 清晰、Secret 外置。"],
        ["数据库脚本", "schema/seed/demo/third-party 分层；生产不导入 demo/test/历史日志。"],
        ["权限矩阵", "菜单、按钮、接口、报表、OpenAPI、AI/RAG 知识库都有角色边界。"],
        ["报表规范", "数据源、SQL、参数、导出、分享、敏感字段、审计规则明确。"],
        ["AI/RAG 规范", "模型 Key、知识库权限、向量库、工具调用、成本和输出审计明确。"],
        ["运维手册", "部署、备份、恢复、日志、监控、告警、账号交接流程明确。"],
    ], ["28%", "72%"])}
    <div class="note">
      <strong>最终建议：</strong>不要把 Miiow Center 当成“把 JEECG 跑起来”来推进，而要当成信息中心的基础平台建设。第一目标是可控、可审计、可运维；第二目标才是快速交付低代码、报表和 AI 能力；第三目标才是服务化拆分。
    </div>
  </section>
</body>
</html>"""
    HTML_PATH.write_text(html, encoding="utf-8")
    print(HTML_PATH)


if __name__ == "__main__":
    write_html()
