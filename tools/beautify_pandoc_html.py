from __future__ import annotations

import re
import sys
from html import escape
from pathlib import Path


CSS = r"""
    :root {
      color-scheme: light;
      --page: #f5f7fb;
      --surface: #ffffff;
      --surface-soft: #f8fafc;
      --ink: #172033;
      --muted: #637083;
      --line: #d9e1ec;
      --line-strong: #b9c6d8;
      --accent: #2563eb;
      --accent-2: #0f766e;
      --accent-soft: #eaf1ff;
      --toc: #101827;
      --toc-muted: #aab7ca;
      --table-head: #e8f0fb;
      --warn-soft: #fff7e6;
      --shadow: 0 18px 45px rgba(24, 35, 61, 0.10);
    }

    * {
      box-sizing: border-box;
    }

    html {
      margin: 0;
      scroll-behavior: smooth;
      background: var(--page);
      color: var(--ink);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
        "Microsoft YaHei", "Noto Sans CJK SC", Arial, sans-serif;
      font-size: 16px;
      line-height: 1.72;
    }

    body {
      margin: 0;
      min-height: 100vh;
      background:
        linear-gradient(180deg, rgba(37, 99, 235, 0.08), rgba(37, 99, 235, 0) 280px),
        var(--page);
      color: var(--ink);
      text-rendering: optimizeLegibility;
      overflow-wrap: break-word;
    }

    a {
      color: var(--accent);
      text-decoration-thickness: 0.08em;
      text-underline-offset: 0.18em;
    }

    img, svg {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
    }

    .app-shell {
      display: grid;
      grid-template-columns: 320px minmax(0, 1fr);
      gap: 32px;
      max-width: 1480px;
      margin: 0 auto;
      padding: 28px 34px 56px;
    }

    #TOC {
      position: sticky;
      top: 24px;
      align-self: start;
      max-height: calc(100vh - 48px);
      overflow: auto;
      padding: 22px 18px 20px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 8px;
      background: var(--toc);
      box-shadow: var(--shadow);
      color: #f8fafc;
    }

    #TOC::before {
      content: "目录";
      display: block;
      margin: 0 0 14px;
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.13);
      color: #ffffff;
      font-size: 0.95rem;
      font-weight: 750;
      letter-spacing: 0;
    }

    #TOC ul {
      margin: 0;
      padding-left: 0;
      list-style: none;
    }

    #TOC ul ul {
      margin-top: 4px;
      padding-left: 12px;
      border-left: 1px solid rgba(255, 255, 255, 0.11);
    }

    #TOC li {
      margin: 0;
    }

    #TOC a {
      display: block;
      padding: 5px 7px;
      border-radius: 6px;
      color: var(--toc-muted);
      font-size: 0.84rem;
      line-height: 1.42;
      text-decoration: none;
    }

    #TOC a:hover {
      background: rgba(255, 255, 255, 0.08);
      color: #ffffff;
    }

    .doc-content {
      min-width: 0;
      padding: 52px 72px 72px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--surface);
      box-shadow: var(--shadow);
    }

    .doc-content > p:first-child {
      margin: 0;
      color: var(--accent);
      font-size: clamp(2rem, 4vw, 3.25rem);
      line-height: 1.16;
      font-weight: 800;
      letter-spacing: 0;
    }

    .doc-content > p:nth-child(2),
    .doc-content > p:nth-child(4) {
      margin-top: 10px;
      color: var(--muted);
      font-size: 1rem;
    }

    .doc-content > p:nth-child(3) {
      display: none;
    }

    h1, h2, h3, h4, h5, h6 {
      color: var(--ink);
      line-height: 1.34;
      letter-spacing: 0;
      scroll-margin-top: 24px;
    }

    h1 {
      margin: 52px 0 18px;
      padding-top: 22px;
      border-top: 2px solid var(--line);
      color: #0f3460;
      font-size: 1.75rem;
      font-weight: 800;
    }

    h2 {
      margin: 34px 0 12px;
      padding-left: 12px;
      border-left: 4px solid var(--accent);
      color: #18345d;
      font-size: 1.28rem;
      font-weight: 760;
    }

    h3 {
      margin: 24px 0 8px;
      color: #18554f;
      font-size: 1.06rem;
      font-weight: 720;
    }

    p {
      margin: 0.68em 0;
    }

    h1 + p, h2 + p, h3 + p {
      margin-top: 0.35em;
    }

    strong {
      color: #0f172a;
      font-weight: 760;
    }

    blockquote {
      margin: 18px 0;
      padding: 14px 18px;
      border: 1px solid #f2d38a;
      border-left: 5px solid #d97706;
      border-radius: 8px;
      background: var(--warn-soft);
      color: #543400;
    }

    code, pre {
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    }

    code {
      padding: 0.12em 0.35em;
      border-radius: 5px;
      background: #edf2f7;
      color: #8a1f11;
      font-size: 0.9em;
    }

    pre {
      overflow: auto;
      margin: 18px 0;
      padding: 16px;
      border: 1px solid #c7d2e2;
      border-radius: 8px;
      background: #0f172a;
      color: #e5edf7;
      line-height: 1.58;
    }

    pre code {
      padding: 0;
      background: transparent;
      color: inherit;
    }

    ul, ol {
      margin: 0.7em 0 0.9em;
      padding-left: 1.5em;
    }

    li {
      margin: 0.28em 0;
    }

    table {
      display: block;
      width: 100%;
      max-width: 100%;
      margin: 20px 0 26px;
      overflow-x: auto;
      border-collapse: collapse;
      border-spacing: 0;
      font-size: 0.94rem;
      line-height: 1.58;
      font-variant-numeric: tabular-nums;
    }

    thead, tbody {
      border: 0;
    }

    th, td {
      min-width: 96px;
      padding: 11px 13px;
      border: 1px solid var(--line);
      vertical-align: top;
      text-align: left;
      color: var(--ink);
      background: #ffffff;
    }

    th {
      background: var(--table-head);
      color: #14345c;
      font-weight: 760;
      white-space: nowrap;
    }

    tr:nth-child(even) td {
      background: var(--surface-soft);
    }

    figure {
      margin: 22px 0;
    }

    .diagram-panel {
      margin: 22px 0 26px;
      padding: 22px;
      border: 1px solid #cbd8ea;
      border-radius: 8px;
      background: linear-gradient(180deg, #fbfdff, #f5f8fc);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
    }

    .diagram-title {
      margin: 0 0 4px;
      color: #12233f;
      font-weight: 800;
      font-size: 1.02rem;
    }

    .diagram-subtitle {
      margin: 0 0 18px;
      color: var(--muted);
      font-size: 0.88rem;
    }

    .flow-row {
      display: grid;
      grid-template-columns: repeat(var(--flow-count), minmax(96px, 1fr));
      gap: 10px;
      align-items: stretch;
    }

    .flow-node, .stack-node, .branch-node, .tree-node, .gate-node {
      position: relative;
      min-height: 70px;
      padding: 12px 10px;
      border: 1px solid #9dbde6;
      border-radius: 8px;
      background: #eef6ff;
      color: #13233b;
      text-align: center;
      font-weight: 720;
      line-height: 1.35;
    }

    .flow-node::after {
      content: "";
      position: absolute;
      top: 50%;
      right: -12px;
      width: 12px;
      height: 2px;
      background: #79a3d4;
    }

    .flow-node::before {
      content: "";
      position: absolute;
      top: calc(50% - 5px);
      right: -15px;
      border-top: 6px solid transparent;
      border-bottom: 6px solid transparent;
      border-left: 8px solid #79a3d4;
    }

    .flow-node:last-child::before,
    .flow-node:last-child::after {
      display: none;
    }

    .node-detail {
      display: block;
      margin-top: 5px;
      color: #596980;
      font-size: 0.78rem;
      font-weight: 500;
    }

    .diagram-note {
      margin: 18px 0 0;
      padding: 12px 14px;
      border: 1px solid #cad6e6;
      border-radius: 8px;
      background: #ffffff;
      color: #28415f;
      text-align: center;
      font-size: 0.9rem;
    }

    .gate-row {
      display: grid;
      grid-template-columns: repeat(var(--gate-count), minmax(70px, 1fr));
      gap: 8px;
      align-items: center;
    }

    .gate-node {
      min-height: 60px;
      background: #ecfdf5;
      border-color: #85c9a8;
      color: #0f5138;
    }

    .gate-node.review {
      background: #fff7ed;
      border-color: #f0b46b;
      color: #7a3d00;
    }

    .branch-grid {
      display: grid;
      grid-template-columns: 1fr 1.15fr 1fr;
      gap: 12px;
      align-items: center;
    }

    .branch-node {
      min-height: 88px;
      background: #eef2ff;
      border-color: #a7b8ee;
    }

    .branch-stack {
      display: grid;
      gap: 10px;
    }

    .branch-node.level-a { background: #fef2f2; border-color: #ef9a9a; color: #7f1d1d; }
    .branch-node.level-b { background: #fff7ed; border-color: #f0b46b; color: #7a3d00; }
    .branch-node.level-c { background: #ecfdf5; border-color: #85c9a8; color: #0f5138; }

    .tree-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 12px;
      align-items: stretch;
    }

    .tree-node {
      min-height: 86px;
      background: #f0fdfa;
      border-color: #77c8bf;
    }

    .stack-diagram {
      display: grid;
      gap: 8px;
      max-width: 760px;
      margin: 0 auto;
    }

    .stack-node {
      min-height: 48px;
      background: #f8fafc;
      border-color: #b6c4d6;
      text-align: left;
    }

    .stack-node strong {
      display: inline-block;
      min-width: 110px;
      color: #12345b;
    }

    figcaption {
      margin-top: 8px;
      color: var(--muted);
      font-size: 0.9rem;
      text-align: center;
    }

    hr {
      height: 1px;
      margin: 32px 0;
      border: 0;
      background: var(--line);
    }

    @media (max-width: 980px) {
      .app-shell {
        display: block;
        padding: 16px;
      }

      #TOC {
        position: relative;
        top: 0;
        max-height: 360px;
        margin-bottom: 18px;
      }

      .doc-content {
        padding: 34px 22px 44px;
      }
    }

    @media print {
      html, body {
        background: #ffffff;
      }

      .app-shell {
        display: block;
        max-width: none;
        padding: 0;
      }

      #TOC {
        position: static;
        max-height: none;
        margin-bottom: 24px;
        border: 1px solid #cccccc;
        background: #ffffff;
        box-shadow: none;
        color: #111111;
      }

      #TOC::before,
      #TOC a {
        color: #111111;
      }

      .doc-content {
        padding: 0;
        border: 0;
        box-shadow: none;
      }

      h1, h2, h3 {
        page-break-after: avoid;
      }

      table {
        page-break-inside: avoid;
      }
    }
"""


def node(label: str, detail: str = "", cls: str = "") -> str:
    extra = f" {cls}" if cls else ""
    detail_html = f'<span class="node-detail">{escape(detail)}</span>' if detail else ""
    return f'<div class="{extra.strip() or "flow-node"}">{escape(label)}{detail_html}</div>'


def flow(title: str, subtitle: str, nodes: list[tuple[str, str]], note: str = "") -> str:
    items = "".join(node(label, detail) for label, detail in nodes)
    note_html = f'<p class="diagram-note">{escape(note)}</p>' if note else ""
    return f"""
<div class="diagram-panel" role="img" aria-label="{escape(title)}">
  <p class="diagram-title">{escape(title)}</p>
  <p class="diagram-subtitle">{escape(subtitle)}</p>
  <div class="flow-row" style="--flow-count:{len(nodes)}">{items}</div>
  {note_html}
</div>"""


def gate_flow() -> str:
    nodes = [
        ("启动", "立项、目标、干系人"),
        ("G1", "启动转规划"),
        ("规划", "WBS、里程碑、风险"),
        ("G2", "规划转执行"),
        ("执行", "任务推进、质量控制"),
        ("G3", "执行转交付"),
        ("交付", "验收、发布、移交"),
        ("G4", "交付转运维"),
        ("运维", "监控、复盘、改进"),
    ]
    items = "".join(
        f'<div class="gate-node{" review" if label.startswith("G") else ""}">{escape(label)}'
        f'<span class="node-detail">{escape(detail)}</span></div>'
        for label, detail in nodes
    )
    return f"""
<div class="diagram-panel" role="img" aria-label="项目生命周期阶段与评审流程">
  <p class="diagram-title">项目生命周期阶段与评审流程</p>
  <p class="diagram-subtitle">五阶段推进，四个评审点作为进入下一阶段的质量门。</p>
  <div class="gate-row" style="--gate-count:{len(nodes)}">{items}</div>
  <p class="diagram-note">未达到评审条件不得转入下一阶段；重大风险需上报决策并留痕。</p>
</div>"""


def branch_diagram() -> str:
    return """
<div class="diagram-panel" role="img" aria-label="项目流程分级决策">
  <p class="diagram-title">项目流程分级决策</p>
  <p class="diagram-subtitle">以项目规模、影响范围与风险损失为主要判断依据。</p>
  <div class="branch-grid">
    <div class="branch-node">输入判断<span class="node-detail">规模 / 影响 / 风险 / 合规</span></div>
    <div class="branch-node">损失程度评估<span class="node-detail">高损失优先提高管控级别</span></div>
    <div class="branch-stack">
      <div class="branch-node level-a">A 级<span class="node-detail">重大、合同、合规项目：全流程评审并归档</span></div>
      <div class="branch-node level-b">B 级<span class="node-detail">常规团队项目：五阶段四评审点</span></div>
      <div class="branch-node level-c">C 级<span class="node-detail">个人/预研项目：轻量自查与发布确认</span></div>
    </div>
  </div>
</div>"""


def tree_diagram() -> str:
    return """
<div class="diagram-panel" role="img" aria-label="需求三层分解结构">
  <p class="diagram-title">需求三层分解结构</p>
  <p class="diagram-subtitle">需求必须逐层拆到可估算、可执行、可验收的任务粒度。</p>
  <div class="tree-grid">
    <div class="tree-node">史诗 Epic<span class="node-detail">业务目标或较大能力域</span></div>
    <div class="tree-node">特性 Feature / Story<span class="node-detail">可独立交付的用户价值</span></div>
    <div class="tree-node">任务 Task<span class="node-detail">明确负责人、估算、验收点</span></div>
  </div>
  <p class="diagram-note">未经分解的需求不得直接进入执行；任务卡片必须带验收标准。</p>
</div>"""


def stack_diagram() -> str:
    layers = [
        ("安全治理", "权限、密钥、备份、安全扫描"),
        ("监控度量", "日志、指标、告警、质量趋势"),
        ("部署运行", "环境、发布、回滚、运行配置"),
        ("制品仓库", "构建产物、版本包、镜像"),
        ("CI/CD", "检查、构建、测试、部署流水线"),
        ("版本控制", "分支、提交、合并请求、标签"),
        ("需求协作", "需求、任务、看板、里程碑"),
    ]
    rows = "".join(
        f'<div class="stack-node"><strong>{escape(label)}</strong>{escape(detail)}</div>'
        for label, detail in layers
    )
    return f"""
<div class="diagram-panel" role="img" aria-label="工具链七层架构">
  <p class="diagram-title">工具链七层架构</p>
  <p class="diagram-subtitle">按职责分层选型，先确定流程问题，再配置对应工具。</p>
  <div class="stack-diagram">{rows}</div>
</div>"""


DIAGRAMS = [
    flow(
        "文档体系总览",
        "从项目治理到工程规范形成闭环，覆盖软件研发与内容创作双栈。",
        [
            ("流程规范", "生命周期 / 需求任务 / 版本分支"),
            ("工具自动化", "CI/CD / 工具链 / 内容流水线"),
            ("风险安全", "风险登记 / 应急响应 / 权限备份"),
            ("开发规范", "代码 / 命名 / 数据库 / API"),
            ("模板附录", "里程碑 / 风险 / 复盘"),
        ],
        "治理闭环：标准输入 -> 自动化校验 -> 可追溯交付 -> 持续度量与复盘改进。",
    ),
    gate_flow(),
    branch_diagram(),
    tree_diagram(),
    flow(
        "任务看板状态流转",
        "五列看板呈现任务从准备到完成的可视化路径。",
        [
            ("待办", "已分解且可排序"),
            ("分析/准备", "补齐信息与依赖"),
            ("进行中", "WIP 建议 ≤ 3"),
            ("审查", "代码/内容质检，WIP 建议 ≤ 2"),
            ("完成", "满足 DoD 并归档"),
        ],
        "阻塞任务应标记原因并优先解除，不应长期占用进行中容量。",
    ),
    flow(
        "GitHub Flow 分支模型",
        "主分支保持可发布，所有变更通过短生命周期分支与合并请求进入主干。",
        [
            ("main", "受保护、可发布"),
            ("feature/fix/content", "按任务创建短分支"),
            ("commit", "约定式提交，原子变更"),
            ("PR/MR", "自动检查与审查"),
            ("merge", "通过后合并主干"),
            ("tag/release", "发布或内容定版"),
        ],
    ),
    flow(
        "CI/CD 标准流水线阶段",
        "七阶段流水线用于快速反馈、质量门禁和可追溯交付。",
        [
            ("触发", "push / PR / tag / 手动"),
            ("代码检查", "格式、静态分析"),
            ("构建", "依赖与产物生成"),
            ("测试", "单元/集成/回归"),
            ("安全扫描", "密钥、依赖、镜像"),
            ("制品归档", "版本化留存"),
            ("部署/发布", "环境发布与回滚点"),
        ],
    ),
    stack_diagram(),
    flow(
        "内容创作工业化流水线",
        "内容生产按阶段推进，质检与数据复盘形成持续改进。",
        [
            ("选题立项", "目标、受众、平台"),
            ("素材准备", "资料、授权、设定"),
            ("生产创作", "正文、视觉、视频"),
            ("质检校对", "事实、版权、AI 味检测"),
            ("发布分发", "平台适配与排期"),
            ("数据复盘", "表现分析与选题反馈"),
        ],
        "复盘结果回流到下一轮选题与生产标准。",
    ),
    flow(
        "应急响应五步流程",
        "事故处理优先控制影响和恢复服务，复盘在恢复后完成。",
        [
            ("识别分级", "确认范围与严重度"),
            ("控制影响", "止血、隔离、降级"),
            ("恢复服务", "回滚、修复、验证"),
            ("通报同步", "相关方及时获知"),
            ("复盘改进", "根因、措施、责任人"),
        ],
        "原则：先恢复后查因，先通报后完善，对事不对人。",
    ),
    flow(
        "备份 3-2-1 原则",
        "核心数据至少三份副本、两种介质、一份异地，并定期恢复演练。",
        [
            ("3 份数据", "生产数据 + 两份备份"),
            ("2 种介质", "本地存储 + 对象/云存储"),
            ("1 份异地", "异地或云端隔离副本"),
            ("恢复演练", "季度验证可恢复性"),
        ],
    ),
]


def replace_images(html: str) -> str:
    pattern = re.compile(r"<p><img\s+src=\"[^\"]+\"\s+style=\"[^\"]*\"\s*/></p>", re.S)
    index = 0

    def repl(_: re.Match[str]) -> str:
        nonlocal index
        if index < len(DIAGRAMS):
            value = DIAGRAMS[index]
        else:
            value = ""
        index += 1
        return value

    return pattern.sub(repl, html)


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: beautify_pandoc_html.py input.html output.html", file=sys.stderr)
        return 2

    src = Path(sys.argv[1])
    dst = Path(sys.argv[2])
    html = src.read_text(encoding="utf-8")

    html = re.sub(
        r"  <style>.*?  </style>",
        "  <style>\n" + CSS.strip("\n") + "\n  </style>",
        html,
        count=1,
        flags=re.S,
    )
    html = html.replace("<body>\n", '<body>\n<div class="app-shell">\n', 1)
    html = html.replace("</nav>\n", '</nav>\n<main class="doc-content">\n', 1)
    html = html.replace("</body>", "</main>\n</div>\n</body>", 1)
    html = html.replace("<title>00-项目管理与DevOps开发机制管理文档-合订本-美化版</title>", "<title>项目管理与DevOps开发机制管理文档</title>")
    html = re.sub(r'src="[^"]*/html_preview/(media/[^"]+)"', r'src="\1"', html)
    html = replace_images(html)

    dst.write_text(html, encoding="utf-8")
    print(dst)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
