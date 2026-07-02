from __future__ import annotations

import re
import sys
from pathlib import Path

from lxml import html


DROP_TERMS = (
    "内容创作",
    "内容项目",
    "小说",
    "短视频",
    "新媒体",
    "IP 视觉",
    "IP视觉",
    "版权投诉",
    "账号被封",
    "内容平台",
    "三审制",
    "AI 味",
    "选题",
    "素材",
    "主编",
    "作者",
    "画师",
)


REPLACEMENTS = {
    "项目管理与开发机制管理文档": "信息中心项目管理与开发协作手册",
    "项目管理与DevOps开发机制管理文档": "信息中心项目管理与开发协作手册",
    "猫人信息中心信息中心项目管理与开发协作手册体系": "猫人信息中心项目管理与开发协作手册体系",
    "分支命名按类型前缀（feat/、fix/、content/）": "分支命名按类型前缀（feat/、fix/、docs/、chore/）",
    "覆盖软件研发项目及内容创作项目的全生命周期管理": "覆盖信息系统项目从需求、开发、测试、发布到运维的主要管理活动",
    "软件研发与内容创作双栈通用；": "适用于信息中心管理、产品、开发、测试、运维协作；",
    "方法论与工具实践并重；": "流程规则与工具实践并重；",
    "轻量与完整可伸缩，适用于个人项目至多人协作。": "按项目规模裁剪，避免为小项目引入过重流程。",
    "第四篇 开发规范": "第四篇 工程规范",
    "第五篇 模板与附录": "第五篇 模板与附录",
    "本规范规定了公司信息化项目及内容创作项目生命周期管理的阶段划分、阶段评审、流程分级及基本要求。": "本规范规定信息系统项目生命周期管理的阶段划分、阶段评审、流程分级及基本要求。",
    "本规范适用于公司全部软件研发项目及内容创作项目（含小说、IP 视觉、短视频、新媒体运营等）的立项、计划、实施、交付及运维全过程管理。": "本规范适用于信息中心负责或参与的信息系统建设、产品需求、数据、集成、运维改造及自动化项目。",
    "研发或内容创作实施": "研发、测试及配置实施",
    "双栈管理": "角色与职责",
    "工具链按职责划分为七个层级。工具链分层架构示意见图 7。": "工具链按职责划分为七个层级。工具链分层架构示意见图 7。",
    "从项目治理到工程规范形成闭环，覆盖软件研发与内容创作双栈。": "围绕信息系统项目治理、产品协作和工程交付建立统一工作基线。",
    "工具自动化": "工程工具",
    "CI/CD / 工具链 / 内容流水线": "CI/CD / 代码托管 / 监控",
    "内容创作工业化流水线": "发布与运维协作流程",
    "内容生产按阶段推进，质检与数据复盘形成持续改进。": "从需求确认到上线运维，强调检查点、发布控制和持续改进。",
    "选题立项": "需求确认",
    "目标、受众、平台": "目标、范围、干系人",
    "素材准备": "方案设计",
    "资料、授权、设定": "架构、接口、数据",
    "生产创作": "开发实现",
    "正文、视觉、视频": "代码、配置、脚本",
    "质检校对": "测试验收",
    "事实、版权、AI 味检测": "功能、性能、安全检查",
    "发布分发": "上线发布",
    "平台适配与排期": "变更窗口、回滚方案",
    "数据复盘": "运维复盘",
    "表现分析与选题反馈": "监控指标与问题改进",
    "复盘结果回流到下一轮选题与生产标准。": "复盘结果进入需求池、技术债清单和流程改进项。",
    "图 8 内容创作工业化流水线": "图 8 发布与运维协作流程",
    "完成标准：代码或内容通过审查、测试或质检、文档更新后方可认定完成。": "完成标准：代码、配置、脚本、数据结构或文档变更通过审查、测试和必要的发布检查后方可认定完成。",
    "代码、内容成品、过程文档": "代码、配置、测试报告、过程文档",
    "通过代码审查或内容审查，并通过测试或质量检验": "通过代码审查、测试验证和发布检查",
    "代码或内容主分支应始终保持可发布状态，不得直接向主分支提交未经审查的内容。": "主分支应始终保持可发布状态，不得直接提交未经审查的变更。",
    "代码/内容质检": "开发/测试检查",
    "feature/fix/content": "feature/fix/docs",
    "发布或内容定版": "发布或版本归档",
    "内容产出": "文档变更",
    "content/mu03-chengwaihuangyuan": "docs/api-readme",
    "项目全部产物应纳入版本控制，包括但不限于代码、配置、文档、提示词库、写作大纲等。": "项目关键产物应纳入版本控制，包括代码、配置、接口文档、数据库脚本、部署脚本和运维文档。",
    "将镜像、包或内容成品归档至制品仓库": "将镜像、包或部署制品归档至制品仓库",
    "本规范适用于项目全生命周期的版本管理活动，包括软件研发项目及内容创作项目。": "本规范适用于信息系统项目的代码、配置、脚本、接口文档及部署制品版本管理活动。",
    "内容项目的文本类资产宜采用 Git 管理，包括大纲、正文、素材索引等。": "接口文档、数据库脚本、部署脚本和配置模板应纳入版本管理。",
    "内容项目版本": "配置与文档版本",
    "内容项目的原始大图及视频不应纳入 Git，应使用对象存储或网盘管理，仓库仅存储成品及索引。": "大体积二进制制品不应直接纳入 Git，应使用制品库或对象存储，仓库仅保留构建脚本和索引。",
    "本规范规定了项目安全基线、权限模型、密钥管理、备份策略、内容项目安全合规及安全事件响应的要求。": "本规范规定项目安全基线、权限模型、密钥管理、备份策略及安全事件响应要求。",
    "本规范适用于项目全生命周期的安全管理活动，包括软件研发项目及内容创作项目。": "本规范适用于信息系统项目的开发、测试、发布、运维和数据处理活动。",
    "代码托管、云服务、内容平台等重要平台账号应强制开启": "代码托管、云服务、运维平台等重要账号应强制开启",
    "内容成品/素材": "接口文档/配置模板",
    "网盘 + 本地 + 仓库索引": "Git / 制品库 / 对象存储",
    "内容项目另增：版权/合规/账号/原创。": "涉及数据、接口、权限、外部依赖的风险需单列说明。",
    "内容下架情况（如适用）": "服务降级或数据修复情况（如适用）",
    "闭环": "完成验证",
    "全生命周期": "全过程",
    "落地": "执行",
    "工业化": "标准化",
    "双栈": "协作",
}


def direct_text(el) -> str:
    return "".join(el.itertext()).strip()


def remove_range(children: list, start_idx: int, stop_predicate) -> None:
    parent = children[start_idx].getparent()
    i = start_idx
    while i < len(children):
        el = children[i]
        if i > start_idx and stop_predicate(el):
            break
        parent.remove(el)
        i += 1


def remove_section_by_heading(main, tag: str, label: str, stop_tags: tuple[str, ...]) -> None:
    children = list(main)
    for idx, el in enumerate(children):
        if el.tag == tag and label in direct_text(el):
            remove_range(children, idx, lambda n: n.tag in stop_tags)
            return


def remove_document_between_titles(main, start_title: str, next_title: str) -> None:
    children = list(main)
    for idx, el in enumerate(children):
        if el.tag == "p" and direct_text(el) == start_title:
            remove_range(children, idx, lambda n: n.tag == "p" and direct_text(n) == next_title)
            return


def replace_role_section(main) -> None:
    children = list(main)
    for idx, el in enumerate(children):
        if el.tag == "h1" and "角色与职责" in direct_text(el):
            stop = idx + 1
            while stop < len(children) and children[stop].tag != "h1":
                stop += 1
            parent = el.getparent()
            insert_at = parent.index(el)
            for old in children[idx:stop]:
                parent.remove(old)
            fragments = html.fragments_fromstring(
                """
<h1 id="角色与职责">7 角色与职责</h1>
<p>信息系统项目应明确业务、产品、研发、测试、运维和安全职责。小项目可由一人兼任多个角色，但职责不可缺失。</p>
<table>
<tbody>
<tr><td><strong>角色</strong></td><td><strong>主要职责</strong></td><td><strong>典型产出</strong></td></tr>
<tr><td>项目负责人</td><td>组织计划、协调资源、跟踪风险、推动评审和验收。</td><td>项目计划、里程碑、风险清单、会议纪要</td></tr>
<tr><td>产品负责人</td><td>澄清业务目标、维护需求优先级、确认验收标准。</td><td>需求文档、原型、验收标准、发布说明</td></tr>
<tr><td>技术负责人</td><td>负责技术方案、架构决策、代码质量和关键技术风险。</td><td>技术方案、接口设计、代码审查记录</td></tr>
<tr><td>开发人员</td><td>按任务实现功能、补充测试、提交合并请求并响应审查意见。</td><td>代码、单元测试、数据库脚本、配置变更</td></tr>
<tr><td>测试/质量人员</td><td>制定测试范围，执行功能、回归、性能和安全验证。</td><td>测试用例、缺陷记录、测试报告</td></tr>
<tr><td>运维/安全人员</td><td>负责环境、发布、监控、权限、备份、应急响应和安全基线。</td><td>发布记录、监控告警、权限清单、备份验证记录</td></tr>
</tbody>
</table>
<h2 id="协作要求">7.1 协作要求</h2>
<p>需求、设计、开发、测试、发布和运维信息应在统一项目工具中维护。关键决策、范围变更、上线审批和事故处理必须留痕。</p>
"""
            )
            for offset, new_el in enumerate(fragments):
                parent.insert(insert_at + offset, new_el)
            return


def toc_entries() -> list[tuple[str, str, list[tuple[str, str]]]]:
    return [
        (
            "总览",
            "",
            [
                ("文档说明", "1-文档说明"),
                ("文档体系结构", "2-文档体系结构"),
                ("使用指引", "3-使用指引"),
                ("修订记录", "4-修订记录"),
            ],
        ),
        (
            "第一篇 流程规范",
            "",
            [
                ("01 项目生命周期与流程规范", "1-范围"),
                ("02 需求与任务管理规范", "1-范围-2"),
                ("03 版本控制与分支策略", "1-范围-3"),
            ],
        ),
        (
            "第二篇 工具链与自动化",
            "",
            [
                ("04 持续集成与交付流水线规范", "1-范围-4"),
                ("05 工具链选型与集成", "1-范围-5"),
            ],
        ),
        (
            "第三篇 风险与安全",
            "",
            [
                ("07 风险管理与应急响应", "1-范围-6"),
                ("08 安全、权限、备份与密钥管理", "1-范围-7"),
            ],
        ),
        (
            "第四篇 工程规范",
            "",
            [
                ("09 代码规范总则", "1-范围-8"),
                ("10 命名规范详解", "1-范围-9"),
                ("11 数据库设计与命名规范", "1-范围-10"),
                ("12 API 设计规范", "1-范围-11"),
                ("13 代码注释与文档规范", "1-范围-12"),
                ("14 多语言开发规范", "1-范围-13"),
            ],
        ),
        (
            "第五篇 模板与附录",
            "",
            [
                ("附录 A 里程碑计划模板", "a.1-项目基本信息"),
                ("附录 B 风险登记表模板", "b.1-风险登记表"),
                ("附录 C 事故复盘报告模板", "c.1-事故基本信息"),
            ],
        ),
    ]


def append_toc_styles(root) -> None:
    style = root.xpath("//style")[0]
    style.text = (style.text or "") + """

    .print-toc {
      display: none;
    }

    .toc-group-title {
      margin: 14px 0 6px;
      color: #18345d;
      font-size: 0.9rem;
      font-weight: 800;
    }

    .toc-compact-list {
      margin: 0 0 8px;
      padding-left: 0;
      list-style: none;
    }

    .toc-compact-list li {
      margin: 0;
    }

    @media print {
      #TOC {
        display: none !important;
      }

      .print-toc {
        display: block !important;
        margin: 0 0 32px;
        padding: 0;
        page-break-after: always;
      }

      .print-toc h1 {
        margin: 0 0 24px;
        padding: 0 0 10px;
        border-top: 0;
        border-bottom: 2px solid #c9d5e6;
        color: #0f3460;
        font-size: 24pt;
      }

      .print-toc .toc-print-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px 28px;
      }

      .print-toc .toc-print-group {
        break-inside: avoid;
        page-break-inside: avoid;
      }

      .print-toc .toc-group-title {
        margin: 0 0 6px;
        color: #18345d;
        font-size: 12pt;
        font-weight: 800;
      }

      .print-toc ol {
        margin: 0;
        padding-left: 0;
        list-style: none;
      }

      .print-toc li {
        display: flex;
        gap: 8px;
        margin: 4px 0;
        color: #111827;
        font-size: 10.5pt;
        line-height: 1.35;
      }

      .print-toc li::after {
        content: "";
        flex: 1 1 auto;
        border-bottom: 1px dotted #b8c3d3;
        transform: translateY(-4px);
      }

      .print-toc a {
        color: #111827;
        text-decoration: none;
      }
    }
"""


def rebuild_compact_sidebar_toc(root) -> None:
    toc = root.get_element_by_id("TOC")
    for child in list(toc):
        toc.remove(child)
    root_ul = html.Element("ul")
    toc.append(root_ul)
    for group_title, _href, children in toc_entries():
        group_li = html.Element("li")
        label = html.Element("div")
        label.set("class", "toc-group-title")
        label.text = group_title
        group_li.append(label)
        child_ul = html.Element("ul")
        child_ul.set("class", "toc-compact-list")
        for title, target in children:
            li = html.Element("li")
            a = html.Element("a", href=f"#{target}", id=f"toc-{target}")
            a.text = title
            li.append(a)
            child_ul.append(li)
        group_li.append(child_ul)
        root_ul.append(group_li)


def insert_print_toc(main) -> None:
    for existing in main.xpath('.//*[contains(concat(" ", normalize-space(@class), " "), " print-toc ")]'):
        existing.getparent().remove(existing)
    toc = html.Element("section")
    toc.set("class", "print-toc")
    h = html.Element("h1")
    h.text = "目录"
    toc.append(h)
    grid = html.Element("div")
    grid.set("class", "toc-print-grid")
    toc.append(grid)
    for group_title, _href, children in toc_entries():
        group = html.Element("div")
        group.set("class", "toc-print-group")
        title = html.Element("div")
        title.set("class", "toc-group-title")
        title.text = group_title
        group.append(title)
        ol = html.Element("ol")
        for item_title, target in children:
            li = html.Element("li")
            a = html.Element("a", href=f"#{target}")
            a.text = item_title
            li.append(a)
            ol.append(li)
        group.append(ol)
        grid.append(group)

    # Insert after cover metadata and cover diagram, before the first body heading.
    children = list(main)
    insert_at = 0
    for i, el in enumerate(children):
        if el.tag == "h1":
            insert_at = i
            break
    main.insert(insert_at, toc)


def drop_content_columns(root) -> None:
    for table in root.xpath("//table"):
        rows = table.xpath(".//tr")
        if not rows:
            continue
        header_cells = rows[0].xpath("./td|./th")
        headers = [direct_text(c) for c in header_cells]
        drop_indexes = [
            i
            for i, text in enumerate(headers)
            if "内容创作" in text or "内容项目" in text or text == "内容"
        ]
        if not drop_indexes:
            continue
        for row in rows:
            cells = row.xpath("./td|./th")
            for i in sorted(drop_indexes, reverse=True):
                if i < len(cells):
                    row.remove(cells[i])


def drop_rows_with_terms(root) -> None:
    for tr in list(root.xpath("//tr")):
        text = direct_text(tr)
        if any(term in text for term in DROP_TERMS) or "content/" in text:
            parent = tr.getparent()
            if parent is not None:
                parent.remove(tr)


def drop_paragraphs_with_terms(root) -> None:
    for el in list(root.xpath("//p|//h2|//h3|//li")):
        text = direct_text(el)
        if any(term in text for term in DROP_TERMS):
            parent = el.getparent()
            if parent is not None:
                parent.remove(el)


def apply_replacements(root) -> None:
    for el in root.iter():
        if el.text:
            text = el.text
            for old, new in REPLACEMENTS.items():
                text = text.replace(old, new)
            el.text = text
        if el.tail:
            tail = el.tail
            for old, new in REPLACEMENTS.items():
                tail = tail.replace(old, new)
            el.tail = tail
        for attr, value in list(el.attrib.items()):
            if attr in {"id", "href"}:
                continue
            for old, new in REPLACEMENTS.items():
                value = value.replace(old, new)
            el.attrib[attr] = value


def rebuild_toc(root, main) -> None:
    toc = root.get_element_by_id("TOC")
    for child in list(toc):
        toc.remove(child)
    root_ul = html.Element("ul")
    toc.append(root_ul)
    current_h1 = root_ul
    current_h2 = None
    seen: dict[str, int] = {}
    for h in main.xpath(".//h1|.//h2|.//h3"):
        text = direct_text(h)
        if not text:
            continue
        base = re.sub(r"[\s/()（）,，。；;:：、]+", "-", text).strip("-").lower()
        base = re.sub(r"-+", "-", base) or "section"
        seen[base] = seen.get(base, 0) + 1
        hid = base if seen[base] == 1 else f"{base}-{seen[base]}"
        h.set("id", hid)
        li = html.Element("li")
        a = html.Element("a", href=f"#{hid}", id=f"toc-{hid}")
        a.text = text
        li.append(a)
        if h.tag == "h1":
            root_ul.append(li)
            nested = html.Element("ul")
            li.append(nested)
            current_h1 = nested
            current_h2 = None
        elif h.tag == "h2":
            current_h1.append(li)
            nested = html.Element("ul")
            li.append(nested)
            current_h2 = nested
        else:
            (current_h2 if current_h2 is not None else current_h1).append(li)


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: it_manual_cleanup.py input.html output.html", file=sys.stderr)
        return 2

    src = Path(sys.argv[1])
    dst = Path(sys.argv[2])
    doc = html.fromstring(src.read_text(encoding="utf-8"))
    main_el = doc.xpath("//main[contains(concat(' ', normalize-space(@class), ' '), ' doc-content ')]")[0]

    remove_document_between_titles(main_el, "内容创作工业化流水线", "风险管理与应急响应")
    remove_section_by_heading(main_el, "h1", "内容项目持续交付", ("h1",))
    remove_section_by_heading(main_el, "h1", "内容创作工具栈", ("h1",))
    remove_section_by_heading(main_el, "h1", "内容项目安全合规", ("h1",))
    remove_section_by_heading(main_el, "h2", "内容项目特有风险", ("h1", "h2"))
    remove_section_by_heading(main_el, "h2", "内容项目事故判定", ("h1", "h2"))
    remove_section_by_heading(main_el, "h2", "内容项目完成标准", ("h1", "h2"))
    remove_section_by_heading(main_el, "h2", "内容项目里程碑", ("h1", "h2"))
    remove_section_by_heading(main_el, "h2", "内容项目版本", ("h1", "h2"))

    apply_replacements(doc)
    replace_role_section(main_el)
    drop_content_columns(doc)
    drop_rows_with_terms(doc)
    drop_paragraphs_with_terms(doc)
    rebuild_toc(doc, main_el)
    rebuild_compact_sidebar_toc(doc)
    insert_print_toc(main_el)
    append_toc_styles(doc)

    out = html.tostring(doc, encoding="unicode", method="html", doctype="<!DOCTYPE html>")
    dst.write_text(out, encoding="utf-8")
    print(dst)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
