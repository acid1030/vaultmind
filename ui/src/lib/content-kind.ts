type KindSource = {
  kind?: string
  title?: string
  name?: string
  tags?: string
}

const SECRET_HINT = /(?:密钥|密码|口令|凭证|私钥|公钥|api\s*[-_]?\s*key|access\s*[-_]?\s*key|private\s*[-_]?\s*key|token|secret|credential)/i

export function effectiveContentKind(item: KindSource): string {
  if (item.kind !== 'text') return item.kind || 'text'

  const searchable = [item.title, item.name, item.tags].filter(Boolean).join(' ')
  return SECRET_HINT.test(searchable) ? 'secret' : 'text'
}
