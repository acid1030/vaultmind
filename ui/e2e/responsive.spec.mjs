import { _electron as electron } from 'playwright-core'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appPath = path.resolve(__dirname, '..', '..');

(async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultmind-responsive-'))
  const app = await electron.launch({
    args: [appPath, `--user-data-dir=${userDataDir}`],
    env: { ...process.env, NODE_ENV: 'production' },
  })
  const window = await app.firstWindow()
  await window.waitForLoadState('networkidle')

  const registerButton = window.locator('button:has-text("注册")').first()
  if (await registerButton.isVisible().catch(() => false)) await registerButton.click()
  await window.fill('input[placeholder="you@example.com"]', `responsive${Date.now()}@example.com`)
  await window.fill('input[placeholder="你的名字"]', 'ResponsiveUser')
  await window.fill('input[placeholder="至少 8 位"]', 'TestPass123!')
  await window.click('button:has-text("创建账户")')
  await window.waitForSelector('button:has-text("我已保存")')
  await window.click('button:has-text("我已保存")')

  await window.setViewportSize({ width: 1000, height: 700 })
  await window.waitForTimeout(500)

  const sidebarWidth = await window.locator('.vm-sidebar').evaluate(element => element.getBoundingClientRect().width)
  if (sidebarWidth > 90) throw new Error(`Compact sidebar was not activated: ${sidebarWidth}px`)

  const overflow = await window.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  if (overflow > 1) throw new Error(`Dashboard overflows horizontally by ${overflow}px`)
  await window.screenshot({ path: '/tmp/electron-product-home.png' })

  const visualPages = ['知识库', '密码库', '添加内容', '用户组', '开发连接', '同步中心', '设置']
  for (const pageName of visualPages) {
    await window.click(`nav button:has-text("${pageName}")`)
    const hero = window.locator('.vm-page-hero')
    await hero.waitFor({ state: 'visible' })
    await window.waitForTimeout(350)
    const heroBox = await hero.boundingBox()
    if (!heroBox || heroBox.height > 150) throw new Error(`${pageName} page header is too tall: ${heroBox?.height}px`)
    if (await hero.locator('img').count()) throw new Error(`${pageName} page header still contains decorative art`)
    const pageOverflow = await window.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    if (pageOverflow > 1) throw new Error(`${pageName} overflows horizontally by ${pageOverflow}px`)
    if (pageName === '知识库') {
      const composer = window.locator('.vm-library-chat textarea')
      const sendButton = window.locator('.vm-library-chat button').last()
      const composerBox = await composer.boundingBox()
      const sendBox = await sendButton.boundingBox()
      if (!composerBox || !sendBox || composerBox.y + composerBox.height > 700 || sendBox.y + sendBox.height > 700) {
        throw new Error('知识库输入框或发送按钮超出可视区域')
      }
      await window.screenshot({ path: '/tmp/electron-product-library.png' })
    }
    if (pageName === '添加内容') {
      const localDestination = window.getByRole('radio', { name: /保存到本机/ })
      if (!await localDestination.isVisible() || await localDestination.getAttribute('aria-checked') !== 'true') {
        throw new Error('本机文件导入入口在小窗口中不可用')
      }
      await window.screenshot({ path: '/tmp/electron-product-add.png' })
    }
    if (pageName === '同步中心') {
      await window.screenshot({ path: '/tmp/electron-product-sync.png' })
    }
    if (pageName === '设置') {
      await window.screenshot({ path: '/tmp/electron-product-settings.png' })
    }
  }

  await window.screenshot({ path: '/tmp/electron-responsive.png' })
  await window.click('button[title="切换亮色模式"]')
  await window.waitForTimeout(250)
  if (!await window.locator('.vm-page-hero h1').isVisible()) throw new Error('Page title is hidden after switching to the light theme')
  await window.screenshot({ path: '/tmp/electron-responsive-light.png' })
  console.log('Responsive tool layout test passed')
  await app.close()
  fs.rmSync(userDataDir, { recursive: true, force: true })
})()
