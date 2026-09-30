const path = require('path')
const { app, nativeImage } = require('electron')

const root = path.resolve(__dirname, '..')
const sourcePath = path.join(root, 'assets', 'app-icon-axonmind.png')
app.whenReady().then(() => {
  const image = nativeImage.createFromPath(sourcePath)
  const { width, height } = image.getSize()
  const bitmap = image.toBitmap()

// The artwork already contains the final rounded tile. Mask only the square
// canvas outside it so macOS can render its own Dock shadow and silhouette.
const insetX = width * 0.064
const insetY = height * 0.061
const right = width * 0.934
const bottom = height * 0.936
const radius = width * 0.222
const feather = Math.max(2, width * 0.0025)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const nearestX = Math.max(insetX + radius, Math.min(x, right - radius))
      const nearestY = Math.max(insetY + radius, Math.min(y, bottom - radius))
      const distance = Math.hypot(x - nearestX, y - nearestY) - radius
      const alpha = distance <= -feather ? 255 : distance >= feather ? 0 : Math.round(255 * (feather - distance) / (feather * 2))
      bitmap[(y * width + x) * 4 + 3] = Math.min(bitmap[(y * width + x) * 4 + 3], alpha)
    }
  }

  const transparentIcon = nativeImage.createFromBitmap(bitmap, { width, height, scaleFactor: 1 })
  require('fs').writeFileSync(sourcePath, transparentIcon.toPNG())
  require('fs').writeFileSync(
    path.join(root, 'ui', 'src', 'assets', 'app-icon-axonmind.png'),
    transparentIcon.resize({ width: 160, height: 160, quality: 'best' }).toPNG(),
  )
  app.quit()
})
