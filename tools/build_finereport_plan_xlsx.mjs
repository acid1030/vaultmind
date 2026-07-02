import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const inputPath = "/tmp/finereport_log/plan_data.json";
const outputPath = "/Users/t/Documents/猫人/帆软迁移观远开发计划.xlsx";

const data = JSON.parse(await fs.readFile(inputPath, "utf8"));

function colName(n) {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function safeValue(value) {
  if (value === undefined || value === null) return "";
  return value;
}

function matrixFromRecords(records, headers) {
  return records.map((row) => headers.map((h) => safeValue(row[h])));
}

function styleTitle(range) {
  range.format.fill = { color: "#12345B" };
  range.format.font = { color: "#FFFFFF", bold: true, size: 16 };
  range.format.rowHeight = 28;
}

function styleSubtitle(range) {
  range.format.fill = { color: "#EAF1FF" };
  range.format.font = { color: "#18345D", bold: true };
  range.format.wrapText = true;
}

function styleHeader(range) {
  range.format.fill = { color: "#DCE8F8" };
  range.format.font = { color: "#12233F", bold: true };
  range.format.borders = { preset: "all", style: "thin", color: "#C8D4E3" };
  range.format.wrapText = true;
}

function styleBody(range) {
  range.format.borders = { preset: "all", style: "thin", color: "#D9E1EC" };
  range.format.wrapText = true;
  range.format.font = { color: "#172033", size: 10 };
}

function applyWidths(sheet, widths) {
  widths.forEach((width, idx) => {
    sheet.getRange(`${colName(idx + 1)}:${colName(idx + 1)}`).format.columnWidth = width;
  });
}

function writeTableSheet(workbook, name, title, subtitle, headers, records, widths = []) {
  const sheet = workbook.worksheets.add(name);
  sheet.showGridLines = false;
  const lastCol = colName(headers.length);
  sheet.getRange(`A1:${lastCol}1`).merge();
  sheet.getRange("A1").values = [[title]];
  styleTitle(sheet.getRange(`A1:${lastCol}1`));
  sheet.getRange(`A2:${lastCol}2`).merge();
  sheet.getRange("A2").values = [[subtitle]];
  styleSubtitle(sheet.getRange(`A2:${lastCol}2`));
  sheet.getRange(`A4:${lastCol}4`).values = [headers];
  styleHeader(sheet.getRange(`A4:${lastCol}4`));
  if (records.length > 0) {
    const bodyRange = `A5:${lastCol}${4 + records.length}`;
    sheet.getRange(bodyRange).values = matrixFromRecords(records, headers);
    styleBody(sheet.getRange(bodyRange));
  }
  sheet.freezePanes.freezeRows(4);
  if (widths.length) applyWidths(sheet, widths);
  return sheet;
}

function writeOverview(workbook) {
  const sheet = workbook.worksheets.add("总览");
  sheet.showGridLines = false;
  sheet.getRange("A1:F1").merge();
  sheet.getRange("A1").values = [["帆软报表迁移观远开发计划"]];
  styleTitle(sheet.getRange("A1:F1"));

  const cards = [
    ["总报表记录", data.summary["总报表记录"], "查看次数合计", data.summary["查看次数合计"], "导出次数合计", data.summary["导出次数合计"]],
    ["首期迁移候选", data.summary["首期迁移候选"], "预计人天", data.summary["预计人天"], "预计周期", `${data.summary["预计周期周"]} 周 / ${data.summary["人员数"]} 人`],
    ["低频不迁移", data.summary["低频不迁移"], "低频查看次数", data.summary["低频查看次数"], "低频导出次数", data.summary["低频导出次数"]],
    ["待确认", data.summary["待确认"], "Demo不迁移", data.summary["Demo不迁移"], "迁移策略", "查看>5且非Demo"],
  ];
  sheet.getRange("A3:F6").values = cards;
  styleBody(sheet.getRange("A3:F6"));
  sheet.getRange("A3:A6").format.fill = { color: "#EAF1FF" };
  sheet.getRange("C3:C6").format.fill = { color: "#EAF1FF" };
  sheet.getRange("E3:E6").format.fill = { color: "#EAF1FF" };
  sheet.getRange("A3:A6").format.font = { bold: true, color: "#18345D" };
  sheet.getRange("C3:C6").format.font = { bold: true, color: "#18345D" };
  sheet.getRange("E3:E6").format.font = { bold: true, color: "#18345D" };

  sheet.getRange("A8:F8").merge();
  sheet.getRange("A8").values = [["迁移口径"]];
  styleSubtitle(sheet.getRange("A8:F8"));
  const rules = [
    ["1", "查看次数 > 5 的业务报表进入首期迁移候选。"],
    ["2", "查看次数 <= 5 的报表定义为低频报表，首期明确不参与迁移。"],
    ["3", "demo、行业模板、样例驾驶舱等非猫人业务报表不迁移。"],
    ["4", "日志中缺失资源路径或排期天数的记录，迁移前需要业务确认归属与口径。"],
  ];
  sheet.getRange("A9:B12").values = rules;
  styleBody(sheet.getRange("A9:B12"));

  sheet.getRange("A14:F14").merge();
  sheet.getRange("A14").values = [["两人分工"]];
  styleSubtitle(sheet.getRange("A14:F14"));
  const owners = [
    ["人员 A：数据与后端负责人", "梳理帆软数据集、SQL、参数、权限口径；在观远完成数据连接、数据集建模、字段口径核对、定时刷新配置。"],
    ["人员 B：报表与验收负责人", "在观远重建报表页面、筛选条件、图表和导出；组织业务验收，记录差异和修复项。"],
  ];
  sheet.getRange("A15:B16").values = owners;
  styleBody(sheet.getRange("A15:B16"));

  applyWidths(sheet, [20, 48, 18, 18, 18, 28]);
  sheet.freezePanes.freezeRows(1);
}

const workbook = Workbook.create();
writeOverview(workbook);

writeTableSheet(
  workbook,
  "首期迁移范围",
  "首期迁移范围",
  "查看次数 > 5、非 Demo、资源路径有效的业务报表。预计 24 张，约 49 人天。",
  ["序号", "报表名称", "被访问资源", "查看次数", "导出次数", "数据集数量", "排期天数", "估算人天", "估算说明"],
  data.migrate,
  [8, 34, 72, 10, 10, 12, 12, 12, 22],
);

writeTableSheet(
  workbook,
  "低频不迁移",
  "低频报表不迁移清单",
  "查看次数 <= 5，且导出次数为 0。首期明确不参与迁移，后续如有业务诉求单独评审。",
  ["序号", "报表名称", "模板名称", "被访问资源", "查看次数", "导出次数", "数据集数量", "排期天数", "处理结论"],
  data.low,
  [8, 34, 42, 72, 10, 10, 12, 12, 24],
);

writeTableSheet(
  workbook,
  "待确认",
  "待确认但暂不排期",
  "查看次数不低但日志缺失资源路径或业务归属，未确认前不进入迁移排期。",
  ["序号", "报表名称", "模板名称", "被访问资源", "查看次数", "导出次数", "数据集数量", "排期天数", "处理结论"],
  data.pending,
  [8, 34, 42, 40, 10, 10, 12, 12, 36],
);

writeTableSheet(
  workbook,
  "Demo不迁移",
  "Demo/样例报表不迁移清单",
  "非猫人业务报表、demo、行业模板和样例驾驶舱不进入迁移范围。",
  ["序号", "报表名称", "模板名称", "被访问资源", "查看次数", "导出次数", "数据集数量", "排期天数", "处理结论"],
  data.demo,
  [8, 34, 42, 72, 10, 10, 12, 12, 24],
);

writeTableSheet(
  workbook,
  "排期计划",
  "两人排期计划",
  "以 2 人并行为前提，计划周期约 5 周。",
  ["阶段", "周期", "人员A", "人员B", "交付物"],
  data.stages,
  [26, 12, 48, 48, 40],
);

writeTableSheet(
  workbook,
  "风险与依赖",
  "风险与依赖",
  "迁移过程中需要提前管理的主要风险。",
  ["风险", "影响", "应对"],
  data.risks,
  [42, 28, 64],
);

writeTableSheet(
  workbook,
  "原始日志",
  "原始日志",
  "由帆软报表查看日志.xls 转换，仅用于追溯。",
  ["序号", "报表名称", "模板名称", "被访问资源", "查看次数", "导出次数", "数据集数量", "排期天数"],
  data.source_rows,
  [8, 34, 42, 72, 10, 10, 12, 12],
);

const inspect = await workbook.inspect({
  kind: "sheet",
  include: "id,name",
  maxChars: 4000,
});
console.log(inspect.ndjson);

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(outputPath);
