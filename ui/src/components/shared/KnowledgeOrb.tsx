import { useEffect, useRef } from 'react'

// Decorative particles represent the workspace, not inferred semantic relationships.
export default function KnowledgeOrb({ mode }: { mode: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const element = canvas.current
    if (!element) return
    const ctx = element.getContext('2d')
    if (!ctx) return
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    let width = 600, height = 350, frame = 0, disposed = false, visible = true, last = 0, phase = 0
    const TAU = Math.PI * 2
    const hash = (n: number) => { const value = Math.sin(n * 127.1 + 311.7) * 43758.5453; return value - Math.floor(value) }
    const colors = ['#e6b15b', '#48bfdc', '#709be1', '#d36aa9', '#ad85d8', '#c2dfe9']
    const sprites = new Map<string, HTMLCanvasElement>()
    const bloomBuffer = document.createElement('canvas')
    const bloomContext = bloomBuffer.getContext('2d')
    let particles: { u: number; q: number; r: number; slot: number; phase: number; f: number }[] = []
    let particleCount = 0
    function rgba(hex: string, alpha: number) { const value = Number.parseInt(hex.slice(1), 16); return `rgba(${value >> 16},${value >> 8 & 255},${value & 255},${alpha})` }
    function sprite(color: string) {
      if (sprites.has(color)) return sprites.get(color)!
      const buffer = document.createElement('canvas'); buffer.width = buffer.height = 48
      const g = buffer.getContext('2d')!
      const glow = g.createRadialGradient(24, 24, 0, 24, 24, 24)
      glow.addColorStop(0, rgba(color, .55)); glow.addColorStop(.3, rgba(color, .12)); glow.addColorStop(1, rgba(color, 0))
      g.fillStyle = glow; g.fillRect(0, 0, 48, 48)
      g.fillStyle = color; g.beginPath(); g.arc(24, 24, 5.5, 0, TAU); g.fill()
      g.fillStyle = 'rgba(241,251,255,.90)'; g.beginPath(); g.arc(24, 24, 2.2, 0, TAU); g.fill()
      sprites.set(color, buffer); return buffer
    }
    function dot(x: number, y: number, radius: number, color: string, alpha: number) {
      if (!ctx) return
      ctx.globalAlpha = alpha; ctx.drawImage(sprite(color), x-radius, y-radius, radius*2, radius*2); ctx.globalAlpha = 1
    }
    function point(path: number[][], t: number) {
      const m = 1-t
      return { x: m*m*m*path[0][0]+3*m*m*t*path[1][0]+3*m*t*t*path[2][0]+t*t*t*path[3][0], y: m*m*m*path[0][1]+3*m*m*t*path[1][1]+3*m*t*t*path[2][1]+t*t*t*path[3][1] }
    }
    function curve(path: number[][]) {
      ctx!.beginPath(); ctx!.moveTo(path[0][0],path[0][1]); ctx!.bezierCurveTo(path[1][0],path[1][1],path[2][0],path[2][1],path[3][0],path[3][1]); ctx!.stroke()
    }
    function bloom(scale: number, alpha: number) {
      if (!ctx || !bloomContext) return
      const bw = Math.max(1, Math.min(720, Math.round(element!.width/scale))), bh = Math.max(1, Math.min(420, Math.round(element!.height/scale)))
      if (bloomBuffer.width !== bw || bloomBuffer.height !== bh) { bloomBuffer.width = bw; bloomBuffer.height = bh }
      bloomContext.clearRect(0,0,bw,bh); bloomContext.drawImage(element!,0,0,bw,bh)
      ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha
      ctx.drawImage(bloomBuffer,0,0,bw,bh,0,0,element!.width,element!.height); ctx.restore()
    }
    function draw() {
      if (!ctx) return
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.clearRect(0,0,width,height)
      const light = document.documentElement.classList.contains('light')
      const cx = width*.50, cy = height*.49, radius = Math.min(height*.44,width*.36)
      const count = Math.round(Math.max(1000,Math.min(3200,width*height/110)))
      if (count !== particleCount) {
        particleCount = count
        particles = Array.from({ length: count }, (_, i) => {
          const u = hash(i*7+1)*2-1
          return { u, q: Math.sqrt(1-u*u), r: .45+.55*Math.pow(hash(i*7+2),.45), slot: hash(i*7+3), phase: hash(i*7+4)*TAU, f: hash(i*7+5) }
        })
      }
      const halo = ctx.createRadialGradient(cx,cy,0,cx,cy,radius*1.5)
      halo.addColorStop(0,light ? 'rgba(44,126,173,.06)' : 'rgba(56,111,164,.10)'); halo.addColorStop(1,'rgba(36,90,150,0)')
      ctx.fillStyle = halo; ctx.fillRect(0,0,width,height)
      ctx.globalCompositeOperation = light ? 'source-over' : 'lighter'
      for (let source=0; source<5; source++) for (let branch=0; branch<7; branch++) {
        const i = source*7+branch, a = Math.PI*(.6+.8*hash(i+21)), tr = radius*(.55+.4*hash(i+77))
        const tx = cx+Math.cos(a)*tr, ty = cy+Math.sin(a)*tr*.9, sy = (source+.5)/5*height
        const path = [[0,sy],[width*.15,sy+(hash(i)-.5)*20],[cx-radius*1.4,ty+(ty-cy)*.5],[tx,ty]]
        const color = mode === 'types' ? colors[source] : mode === 'tags' ? colors[source%2 ? 4 : 0] : colors[source%3 === 0 ? 0 : source%3 === 1 ? 1 : 3]
        ctx.lineWidth = .65; ctx.strokeStyle = rgba(color,light ? .13 : .095); curve(path)
        for (let f=0; f<3; f++) {
          const t = (phase*(.12+hash(i+f)*.18)+hash(i*3+f))%1, p = point(path,t)
          dot(p.x,p.y,2.5+t*3,color,(light ? .36 : .46)+t*.35)
        }
      }
      for (let i=0;i<7;i++) {
        const a = (-.5+i/6)*1.15, sx = cx+Math.cos(a)*radius*.9, sy = cy+Math.sin(a)*radius*.85, ey=(i+.5)/7*height
        const path = [[sx,sy],[cx+radius*1.45,sy],[width*.84,ey],[width,ey]]
        ctx.strokeStyle = rgba(colors[5],light ? .15 : .11); curve(path)
        const p = point(path,(phase*.18+i*.21)%1); dot(p.x,p.y,3.5,colors[5],.7)
      }
      const breathing = 1+.025*Math.sin(phase*1.2), angle=phase*.14
      const projected = particles.map(p => {
        const theta=p.slot*TAU+angle, x=p.q*Math.cos(theta)*p.r, z=p.q*Math.sin(theta)*p.r
        return { ...p, x:cx+x*radius*breathing, y:cy+p.u*p.r*radius*.92*breathing, depth:(z+1)/2 }
      }).sort((a,b)=>a.depth-b.depth)
      for (const p of projected) {
        const color = mode === 'types' ? colors[Math.min(4,Math.floor(p.slot*5))] : mode === 'tags' ? (p.f<.20 ? colors[0] : colors[4]) : p.f<.09 ? colors[3] : p.slot<.48 ? colors[0] : p.slot<.75 ? (p.f<.5 ? colors[1] : colors[5]) : colors[2]
        const twinkle=.55+.45*Math.sin(phase*2.2+p.phase), size=(2.7+4.3*p.depth)*(p.f<.09 ? 1.25 : 1)
        dot(p.x,p.y,size,color,(.22+.78*p.depth)*twinkle*(light ? .65 : .82))
      }
      // Periodic visual pulse only: never creates records or alters app data.
      const pulse=(phase%4)/.7
      if (pulse<1 && !media.matches) { const px=cx+radius*.18,py=cy-radius*.12; ctx.strokeStyle=rgba(colors[0],(1-pulse)*.55); ctx.lineWidth=1; ctx.beginPath(); ctx.arc(px,py,3+pulse*34,0,TAU); ctx.stroke() }
      ctx.globalAlpha=1; ctx.globalCompositeOperation='source-over'
      if (!light) { bloom(3,.17); bloom(12,.12) }
    }
    function tick(time: number) {
      frame = 0
      if (disposed || !visible || document.hidden || media.matches) return
      if (time-last >= 33) { phase += Math.min((time-last)/1000, .08); last = time; draw() }
      frame = requestAnimationFrame(tick)
    }
    function resume() { cancelAnimationFrame(frame); frame = 0; last = performance.now(); draw(); if (!disposed && visible && !document.hidden && !media.matches) frame = requestAnimationFrame(tick) }
    const resize = new ResizeObserver(entries => { const box = entries[0].contentRect; width = Math.max(1, box.width); height = Math.max(1, box.height); const dpr = Math.min(window.devicePixelRatio || 1, 2); element.width = Math.round(width*dpr); element.height = Math.round(height*dpr); ctx.setTransform(dpr,0,0,dpr,0,0); resume() })
    resize.observe(element)
    const intersection = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; resume() }); intersection.observe(element)
    const theme = new MutationObserver(resume); theme.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    document.addEventListener('visibilitychange', resume); media.addEventListener('change', resume)
    return () => { disposed = true; cancelAnimationFrame(frame); resize.disconnect(); intersection.disconnect(); theme.disconnect(); document.removeEventListener('visibilitychange', resume); media.removeEventListener('change', resume) }
  }, [mode])
  return <canvas ref={canvas} className="vm-orb-canvas" role="img" aria-label="旋转粒子光球与流光连线，知识空间视觉示意" />
}
