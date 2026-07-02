const fs = require('fs');
const path = require('path');

async function extractTextFromBuffer(buffer, fileName) {
  const ext = path.extname(fileName || '').toLowerCase();
  try {
    if (ext === '.pdf') {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      return String(data.text || '').trim();
    }
    if (ext === '.docx') {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      return String(result.value || '').trim();
    }
    if (ext === '.xlsx' || ext === '.xls') {
      const xlsx = require('xlsx');
      const workbook = xlsx.read(buffer, { type: 'buffer' });
      const texts = [];
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const json = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        for (const row of json) {
          texts.push(row.filter(Boolean).join(' '));
        }
      }
      return texts.join('\n').trim();
    }
    if (['.txt', '.md', '.json', '.csv', '.js', '.ts', '.jsx', '.tsx', '.html', '.css', '.py', '.sh', '.yaml', '.yml', '.xml'].includes(ext)) {
      return buffer.toString('utf8').trim();
    }
  } catch (err) {
    console.error(`提取 ${fileName} 内容失败:`, err.message);
  }
  return '';
}

async function extractTextFromFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return '';
  try {
    const buffer = fs.readFileSync(filePath);
    return extractTextFromBuffer(buffer, path.basename(filePath));
  } catch (err) {
    console.error(`读取文件 ${filePath} 失败:`, err.message);
    return '';
  }
}

module.exports = {
  extractTextFromBuffer,
  extractTextFromFile,
};
