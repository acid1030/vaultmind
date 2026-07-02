import { _electron as electron } from 'playwright-core'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const userDataDir = mkdtempSync(join(tmpdir(), 'vm-theme-'))

async function run() {
  const app = await electron.launch({
    args: ['.', `--user-data-dir=${userDataDir}`],
    cwd: '/Users/nike/Documents/project/haichuan/vaultmind',
    env: { ...process.env, NODE_ENV: 'production' },
  })

  const page = await app.firstWindow()
  await page.waitForTimeout(2000)

  await page.screenshot({ path: join(userDataDir, 'initial.png') })

  const bodyText = await page.locator('body').innerText().catch(() => '')
  if (bodyText.includes('创建账户') || bodyText.includes('注册')) {
    const inputs = await page.locator('input').all()
    if (inputs.length >= 3) {
      await inputs[0].fill('theme@test.com')
      await inputs[1].fill('themeuser')
      await inputs[2].fill('Password123!')
    }
    const buttons = await page.locator('button').allInnerTexts()
    const registerIdx = buttons.findIndex(t => t.includes('创建账户'))
    if (registerIdx >= 0) {
      await page.locator('button').nth(registerIdx).click()
      await page.waitForTimeout(1500)
    }
    const allButtons = await page.locator('button').allInnerTexts()
    const enterIdx = allButtons.findIndex(t => t.includes('进入工作台'))
    if (enterIdx >= 0) await page.locator('button').nth(enterIdx).click()
    await page.waitForTimeout(1000)
  }

  await page.screenshot({ path: join(userDataDir, 'dark.png') })

  const toggle = page.locator('button[title="切换亮色模式"], button[title="切换暗色模式"]')
  if (await toggle.count() > 0) {
    await toggle.click()
    await page.waitForTimeout(800)
    await page.screenshot({ path: join(userDataDir, 'light.png') })
  } else {
    console.log('Theme toggle not found')
  }

  console.log('Screenshots saved in', userDataDir)
  await app.close()
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
