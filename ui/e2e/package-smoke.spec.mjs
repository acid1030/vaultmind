import { _electron as electron } from 'playwright-core'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..', '..')
const executablePath = path.join(root, 'release', 'mac-arm64', 'AxonMind.app', 'Contents', 'MacOS', 'AxonMind')
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultmind-package-e2e-'))

if (!fs.existsSync(executablePath)) throw new Error(`找不到打包应用：${executablePath}`)

const app = await electron.launch({ executablePath, args: [`--user-data-dir=${userDataDir}`] })
try {
  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')
  await window.locator('.vm-auth-frame img').first().waitFor()
  const brandImagesReady = await window.locator('.vm-auth-frame img').evaluateAll(images =>
    images.length >= 2 && images.every(image => image.complete && image.naturalWidth > 0),
  )
  if (!brandImagesReady) throw new Error('打包应用未正确加载品牌图片')
  await window.getByRole('button', { name: '注册' }).first().click()
  await window.fill('input[placeholder="you@example.com"]', `package-${Date.now()}@example.com`)
  await window.fill('input[placeholder="你的名字"]', 'PackageTester')
  await window.fill('input[placeholder="至少 8 位"]', 'TestPass123!')
  await window.getByRole('button', { name: '创建账户' }).click()
  await window.getByText('请妥善保存以下恢复码').waitFor()
  await window.getByRole('button', { name: '我已保存' }).click()
  await window.getByRole('button', { name: /同步中心/ }).click()
  await window.getByText('多端协同账号').waitFor()
  await window.getByText('仅本机账号').waitFor()
  const state = await window.evaluate(() => window.vaultApi.getState())
  if (state.settings.localVectorAvailable !== false) throw new Error('精简包不应包含本地向量运行时')
  console.log('Packaged app smoke test passed.')
} finally {
  await app.close()
  fs.rmSync(userDataDir, { recursive: true, force: true })
}
