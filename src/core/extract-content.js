const fs = require('fs');
const path = require('path');

async function extractTextFromBuffer(buffer, fileName) {
  const ext = path.extname(fileName || '').toLowerCase();
  try {
    if (ext === '.pdf') {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const loadingTask = pdfjs.getDocument({
        data: new Uint8Array(buffer),
        isEvalSupported: false,
        useSystemFonts: true,
      });
      const document = await loadingTask.promise;
      const pages = [];
      try {
        for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
          const page = await document.getPage(pageNumber);
          const text = await page.getTextContent();
          pages.push(text.items
            .map((item) => ('str' in item ? item.str : ''))
            .filter(Boolean)
            .join(' '));
          page.cleanup();
        }
      } finally {
        await document.destroy();
      }
      return pages.join('\n').trim();
    }
    if (ext === '.docx') {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      return String(result.value || '').trim();
    }
    if (ext === '.xlsx') {
      const readXlsxFile = require('read-excel-file/node');
      const sheets = await readXlsxFile(buffer, { getSheets: true });
      const texts = [];
      for (const sheet of sheets) {
        const rows = await readXlsxFile(buffer, { sheet: sheet.name });
        for (const row of rows) {
          texts.push(row.filter(value => value !== null && value !== undefined && value !== '').join(' '));
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
