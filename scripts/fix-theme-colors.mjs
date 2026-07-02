import { readFileSync, writeFileSync } from 'fs'

const filePath = process.argv[2]
if (!filePath) {
  console.error('Usage: node fix-theme-colors.mjs <file>')
  process.exit(1)
}

let content = readFileSync(filePath, 'utf-8')

const colorMap = {
  "hsl(210 30% 96%)": "text-foreground",
  "hsl(210 30% 95%)": "text-foreground",
  "hsl(210 30% 94%)": "text-foreground",
  "hsl(210 30% 92%)": "text-foreground",
  "hsl(210 30% 90%)": "text-foreground",
  "hsl(210 30% 88%)": "text-foreground",
  "hsl(210 30% 85%)": "text-foreground",
  "hsl(210 30% 82%)": "text-foreground",
  "hsl(210 30% 78%)": "text-muted-foreground",
  "hsl(218 16% 60%)": "text-muted-foreground",
  "hsl(218 16% 55%)": "text-muted-foreground",
  "hsl(218 16% 52%)": "text-muted-foreground",
  "hsl(218 16% 50%)": "text-muted-foreground",
  "hsl(218 16% 48%)": "text-muted-foreground",
  "hsl(218 16% 46%)": "text-muted-foreground",
  "hsl(218 16% 44%)": "text-muted-foreground",
  "hsl(218 16% 42%)": "text-muted-foreground",
  "hsl(218 16% 40%)": "text-muted-foreground",
  "hsl(218 16% 38%)": "text-muted-foreground",
  "hsl(218 16% 36%)": "text-muted-foreground",
  "hsl(218 16% 32%)": "text-muted-foreground",
}

const bgMap = {
  "hsl(218 36% 8%)": "bg-muted",
  "hsl(218 36% 7%)": "bg-muted",
  "hsl(218 30% 12%)": "bg-muted",
  "hsl(218 30% 10%)": "bg-card",
  "hsl(218 28% 14%)": "bg-muted",
}

const borderMap = {
  "hsl(218 24% 18%)": "var(--border)",
  "hsl(218 24% 16%)": "var(--border)",
  "hsl(218 24% 14%)": "var(--border)",
  "hsl(218 24% 13%)": "var(--border)",
  "hsl(218 24% 12%)": "var(--border)",
}

let total = 0

function mergeClassName(tag, classValue) {
  const existingClassMatch = tag.match(/className="([^"]*)"/)
  if (existingClassMatch) {
    const existing = existingClassMatch[1]
    return tag.replace(/className="[^"]*"/, `className="${existing} ${classValue}"`)
  }
  return tag.replace(/>$/, ` className="${classValue}">`)
}

for (const [color, className] of Object.entries(colorMap)) {
  const escaped = color.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(<[^>]+?)style=\\{\\{\\s*color:\\s*'${escaped}'\\s*\\}\\}`, 'g')
  content = content.replace(regex, (match, tagPrefix) => {
    total++
    return mergeClassName(tagPrefix, className)
  })
}

for (const [bg, className] of Object.entries(bgMap)) {
  const escaped = bg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(<[^>]+?)style=\\{\\{\\s*background:\\s*'${escaped}'\\s*\\}\\}`, 'g')
  content = content.replace(regex, (match, tagPrefix) => {
    total++
    return mergeClassName(tagPrefix, className)
  })
}

for (const [border, variable] of Object.entries(borderMap)) {
  const escaped = border.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(border(?:Bottom|Top|Left|Right)?:\\s*['\"]1px solid )${escaped}(['\"])`, 'g')
  content = content.replace(regex, (match, prefix, suffix) => {
    total++
    return `${prefix}${variable}${suffix}`
  })
}

writeFileSync(filePath, content)
console.log(`Replaced ${total} color values in ${filePath}`)
