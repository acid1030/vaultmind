import { _electron as electron } from 'playwright-core'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const userDataDir = mkdtempSync(join(tmpdir(), 'vm-inspect-'))

async function run() {
  const app = await electron.launch({
    args: ['.', `--user-data-dir=${userDataDir}`],
    cwd: '/Users/nike/Documents/project/haichuan/vaultmind',
    env: { ...process.env, NODE_ENV: 'production' },
  })

  const page = await app.firstWindow()
  await page.waitForTimeout(2000)

  const inputs = await page.locator('input').all()
  if (inputs.length >= 3) {
    await inputs[0].fill('inspect@test.com')
    await inputs[1].fill('inspectuser')
    await inputs[2].fill('Password123!')
  }
  const buttons = await page.locator('button').allInnerTexts()
  const registerIdx = buttons.findIndex(t => t.includes('创建账户'))
  if (registerIdx >= 0) {
    await page.locator('button').nth(registerIdx).click()
    await page.waitForTimeout(1500)
  }

  // Toggle to light
  const toggle = page.locator('button[title="切换亮色模式"], button[title="切换暗色模式"]')
  if (await toggle.count() > 0) await toggle.click()
  await page.waitForTimeout(800)

  // Inspect VaultMind logo text
  const logoSpan = await page.locator('span.text-sm.font-bold.tracking-tight').first()
  const style = await logoSpan.getAttribute('style')
  const computedColor = await logoSpan.evaluate(el => window.getComputedStyle(el).color)
  const htmlClass = await page.locator('html').getAttribute('class')

  console.log('html class:', htmlClass)
  console.log('logo style attr:', style)
  console.log('logo computed color:', computedColor)

  await app.close()
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
