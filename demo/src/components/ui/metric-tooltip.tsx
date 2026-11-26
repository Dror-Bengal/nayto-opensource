import * as React from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

interface MetricTooltipProps {
  children: React.ReactNode
  tooltip: string
  className?: string
}

export function MetricTooltip({ children, tooltip, className }: MetricTooltipProps) {
  const [isVisible, setIsVisible] = React.useState(false)
  const [position, setPosition] = React.useState({ top: 0, left: 0 })
  const triggerRef = React.useRef<HTMLDivElement>(null)
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const updatePosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setPosition({
        top: rect.top + rect.height / 2,
        left: rect.right + 8,
      })
    }
  }

  const showTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    updatePosition()
    setIsVisible(true)
  }

  const hideTooltip = () => {
    setIsVisible(false)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault()
    showTooltip()
    // Auto-hide after 10 seconds on mobile
    timeoutRef.current = setTimeout(() => {
      setIsVisible(false)
    }, 10000)
  }

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return (
    <>
      <div
        ref={triggerRef}
        className={cn('relative inline-flex cursor-help', className)}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onTouchStart={handleTouchStart}
      >
        {children}
      </div>
      {isVisible && createPortal(
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{
            top: position.top,
            left: position.left,
            transform: 'translateY(-50%)',
          }}
        >
          <div className="relative bg-slate-900 text-white text-xs px-3 py-2 rounded-md shadow-xl max-w-[220px] leading-relaxed">
            {/* Arrow pointing left */}
            <div className="absolute right-full top-1/2 -translate-y-1/2 border-[6px] border-transparent border-r-slate-900" />
            {tooltip}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
