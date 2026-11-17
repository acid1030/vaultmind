// Display the status snapshot only; preserve quoted filenames from Git verbatim.
export function projectStatus(output: string, tool: string) {
  const lines = output.split(/\r?\n/).filter(line => line.trim())
  const branch = tool === 'git' ? lines.find(line => line.startsWith('## '))?.slice(3) || '' : ''
  const files = lines.filter(line => tool === 'git' ? /^[ MADRCU?!]{2} /.test(line) : /^[ACDIMRX?!~ ][ CM ][ L ][ +][ S][ KOTB ][ C] /.test(line)).map(line => ({
    status: line.slice(0, tool === 'git' ? 2 : 7).trim() || 'M',
    path: line.slice(tool === 'git' ? 3 : 8),
  }))
  return { branch, files }
}
