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
  return files.find((f) => f.name === fileName) || null;
}

module.exports = {
  parseListFilesResponse,
  findManifestFile,
};
