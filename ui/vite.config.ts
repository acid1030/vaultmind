import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

function lucideDirectImports(): Plugin {
  const entryPath = fileURLToPath(
    new URL('./node_modules/lucide-react/dist/esm/lucide-react.js', import.meta.url),
  )
  const iconFiles = new Map<string, string>()
  const entrySource = readFileSync(entryPath, 'utf8')

  for (const match of entrySource.matchAll(/export \{([^}]+)\} from '\.\/icons\/([^']+)'/g)) {
    for (const alias of match[1].matchAll(/default as ([A-Za-z0-9_$]+)/g)) {
      iconFiles.set(alias[1], match[2])
    }
  }

  return {
    name: 'lucide-direct-imports',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('/src/') || !code.includes("from 'lucide-react'")) return null

      const transformed = code.replace(
        /import\s*\{([^}]*)\}\s*from\s*'lucide-react'/g,
        (_statement, imports: string) => imports
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
          .map((item) => {
            const [exportName, localName = exportName] = item.split(/\s+as\s+/)
            const iconFile = iconFiles.get(exportName)
            if (!iconFile) throw new Error(`Unknown lucide icon export: ${exportName}`)
            return `import ${localName} from 'lucide-react/dist/esm/icons/${iconFile}'`
          })
          .join('\n'),
      )

      return transformed === code ? null : { code: transformed, map: null }
    },
  }
}

export default defineConfig({
  plugins: [lucideDirectImports(), react()],
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: '../src/renderer',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})
