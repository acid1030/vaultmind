import React, { useState, useEffect } from 'react'
import { Sun, Moon } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    return localStorage.getItem('theme') !== 'light'
  })

  useEffect(() => {
    const root = document.documentElement
    if (dark) {
      root.classList.remove('light')
      localStorage.setItem('theme', 'dark')
    } else {
      root.classList.add('light')
      localStorage.setItem('theme', 'light')
    }
  }, [dark])

  return (
    <button
      onClick={() => setDark(!dark)}
      className={cn(
        "relative w-14 h-7 rounded-full transition-all duration-300 flex items-center px-1",
        dark
          ? "bg-[hsl(218_30%_14%)] border border-[hsl(218_24%_18%)]"
          : "bg-[hsl(45_80%_90%)] border border-[hsl(45_60%_70%)]"
      )}
      title={dark ? '切换亮色模式' : '切换暗色模式'}
    >
      <div className={cn(
        "w-5 h-5 rounded-full flex items-center justify-center transition-transform duration-300 shadow-sm",
        dark
          ? "translate-x-0 bg-[hsl(218_36%_22%)]"
          : "translate-x-7 bg-white"
      )}>
        {dark
          ? <Moon className="w-3 h-3" style={{ color: 'hsl(190 90% 72%)' }} />
          : <Sun className="w-3 h-3" style={{ color: 'hsl(43 90% 50%)' }} />}
      </div>
    </button>
  )
}
