function parseListFilesResponse(payload) {
  const data = payload.data || payload;
  const files = Array.isArray(data.files) ? data.files : [];
  return files.map((f) => ({
    token: f.token || f.file_token,
    name: f.name,
    type: f.type,
    url: f.url || '',
    modifiedTime: f.modified_time || f.updated_at,
  }));
}

function findManifestFile(files, fileName) {
  return files
    .filter((f) => f.name === fileName)
    .sort((a, b) => Date.parse(b.modifiedTime || 0) - Date.parse(a.modifiedTime || 0))[0] || null;
}

async function listAllFiles(fetchPage) {
  const files = [];
  const seen = new Set();
  let pageToken = '';
  do {
    const response = await fetchPage(pageToken);
    const data = response.data || response;
    files.push(...parseListFilesResponse(data));
    if (!data.has_more) break;
    pageToken = data.next_page_token || data.page_token;
    if (!pageToken || seen.has(pageToken)) throw new Error('飞书文件分页异常，请重试');
    seen.add(pageToken);
  } while (pageToken);
  return files;
}

module.exports = {
  listAllFiles,
  parseListFilesResponse,
  findManifestFile,
};
