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

module.exports = {
  parseListFilesResponse,
  findManifestFile,
};
