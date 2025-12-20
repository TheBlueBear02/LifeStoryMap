import { useRef, useState, useEffect } from 'react'

/**
 * Hook for managing image comparison slider
 * @param {Object} options - Options object
 * @param {number} options.initialValue - Initial reveal percentage (default: 50)
 * @param {boolean} options.resetOnChange - Reset to 50% when dependency changes (default: false)
 * @param {any} options.resetDependency - Dependency to watch for reset
 * @returns {Object} - { revealPct, setRevealPct, setRevealFromClientX, handlers, compareFrameRef }
 */
export function useImageComparison({ initialValue = 50, resetOnChange = false, resetDependency = null } = {}) {
  const [revealPct, setRevealPct] = useState(initialValue)
  const compareFrameRef = useRef(null)
  const draggingRef = useRef(false)
  const dragStartXRef = useRef(0)
  const dragMovedRef = useRef(false)
  const suppressClickRef = useRef(false)

  const clampPct = (n) => Math.max(0, Math.min(100, n))

  const setRevealFromClientX = (clientX) => {
    const el = compareFrameRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const width = rect.width || 1
    const next = ((clientX - rect.left) / width) * 100
    setRevealPct(clampPct(next))
  }

  // Reset when dependency changes
  useEffect(() => {
    if (resetOnChange && resetDependency !== null) {
      setRevealPct(initialValue)
    }
  }, [resetDependency, resetOnChange, initialValue])

  const handlers = {
    onPointerDown: (e) => {
      draggingRef.current = true
      dragMovedRef.current = false
      suppressClickRef.current = false
      dragStartXRef.current = e.clientX
      e.currentTarget.setPointerCapture?.(e.pointerId)
      setRevealFromClientX(e.clientX)
      e.preventDefault()
    },
    onPointerMove: (e) => {
      if (!draggingRef.current) return
      if (Math.abs(e.clientX - dragStartXRef.current) > 3) {
        dragMovedRef.current = true
      }
      setRevealFromClientX(e.clientX)
      e.preventDefault()
    },
    onPointerUp: (e) => {
      draggingRef.current = false
      e.currentTarget.releasePointerCapture?.(e.pointerId)
      setRevealFromClientX(e.clientX)
      if (dragMovedRef.current) {
        suppressClickRef.current = true
        setTimeout(() => {
          suppressClickRef.current = false
        }, 0)
      }
      e.preventDefault()
    },
    onPointerCancel: () => {
      draggingRef.current = false
    },
    onClick: (e) => {
      if (suppressClickRef.current) {
        e.preventDefault()
        return
      }
      // Quick toggle between the two images (only on true click, not drag).
      setRevealPct((prev) => (prev >= 50 ? 0 : 100))
    },
  }

  return {
    revealPct,
    setRevealPct,
    setRevealFromClientX,
    handlers,
    compareFrameRef,
  }
}

