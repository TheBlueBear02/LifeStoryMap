import { useRef, useState, useEffect } from 'react'

/**
 * Hook for managing mobile card drag interactions
 * @param {Object} options - Options object
 * @param {string} options.initialState - Initial card state ('closed' | 'open')
 * @param {boolean} options.resetOnChange - Reset to closed when dependency changes
 * @param {any} options.resetDependency - Dependency to watch for reset
 * @returns {Object} - { cardState, setCardState, cardDragRef, handlers }
 */
export function useCardDrag({ initialState = 'closed', resetOnChange = false, resetDependency = null } = {}) {
  const [cardState, setCardState] = useState(initialState)
  const cardDragRef = useRef(null)
  const cardDragStartYRef = useRef(0)
  const cardDragStartStateRef = useRef(initialState)
  const isDraggingCardRef = useRef(false)

  // Reset when dependency changes
  useEffect(() => {
    if (resetOnChange && resetDependency !== null) {
      setCardState(initialState)
    }
  }, [resetDependency, resetOnChange, initialState])

  // Prevent pull-to-refresh globally when card is open
  useEffect(() => {
    if (cardState === 'open') {
      document.documentElement.classList.add('view-story-card-open')
      document.body.classList.add('view-story-card-open')
    } else {
      document.documentElement.classList.remove('view-story-card-open')
      document.body.classList.remove('view-story-card-open')
    }

    const preventPullToRefresh = (e) => {
      if (isDraggingCardRef.current) {
        e.preventDefault()
        e.stopPropagation()
        return true
      }

      const cardEl = cardDragRef.current
      if (!cardEl) return false

      const touch = e.touches?.[0] || e.changedTouches?.[0]
      if (!touch) return false

      const cardRect = cardEl.getBoundingClientRect()
      const touchY = touch.clientY
      const scrollTop = cardEl.scrollTop

      const isInCard = touchY >= cardRect.top && touchY <= cardRect.bottom
      const isAtTop = scrollTop <= 5
      const isNearTopEdge = touchY <= cardRect.top + 60

      if (isInCard && isAtTop && isNearTopEdge) {
        e.preventDefault()
        e.stopPropagation()
        return true
      }
      return false
    }

    const handleTouchMove = (e) => {
      if (cardState === 'open' && !isDraggingCardRef.current) {
        const prevented = preventPullToRefresh(e)
        if (prevented) {
          e.stopImmediatePropagation()
        }
      }
    }

    const handleTouchStart = () => {
      // Don't prevent on touchstart to allow drag handlers to work
    }

    document.addEventListener('touchmove', handleTouchMove, { passive: false, capture: true })
    document.addEventListener('touchstart', handleTouchStart, { passive: true, capture: true })

    return () => {
      document.documentElement.classList.remove('view-story-card-open')
      document.body.classList.remove('view-story-card-open')
      document.removeEventListener('touchmove', handleTouchMove, { capture: true })
      document.removeEventListener('touchstart', handleTouchStart, { capture: true })
    }
  }, [cardState])

  const handleCardTouchStart = (e) => {
    if (e.touches.length !== 1) return

    const target = e.target
    const isNavButton = target.closest('.view-story-nav-btn') || target.closest('.view-story-bottom-nav')
    if (isNavButton) {
      isDraggingCardRef.current = false
      return
    }

    const cardEl = cardDragRef.current
    if (!cardEl) return

    const touch = e.touches[0]
    const touchY = touch.clientY
    const cardRect = cardEl.getBoundingClientRect()
    const handleRect = cardEl.querySelector('.view-story-card-handle')?.getBoundingClientRect()

    const isOnHandle = handleRect &&
      touchY >= handleRect.top &&
      touchY <= handleRect.bottom &&
      touch.clientX >= handleRect.left &&
      touch.clientX <= handleRect.right

    const scrollTop = cardEl.scrollTop
    const isAtTop = scrollTop <= 10

    if (isOnHandle || cardState !== 'open' || (cardState === 'open' && isAtTop)) {
      isDraggingCardRef.current = true
      cardDragStartYRef.current = touchY
      cardDragStartStateRef.current = cardState
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      return false
    } else {
      isDraggingCardRef.current = false
    }
  }

  const handleCardTouchMove = (e) => {
    if (!isDraggingCardRef.current || e.touches.length !== 1) return

    const target = e.target
    const isNavButton = target.closest('.view-story-nav-btn') || target.closest('.view-story-bottom-nav')
    if (isNavButton) {
      isDraggingCardRef.current = false
      const cardEl = cardDragRef.current
      if (cardEl) {
        cardEl.classList.remove('is-dragging')
        cardEl.style.removeProperty('--drag-height')
      }
      return
    }

    const cardEl = cardDragRef.current
    if (!cardEl) return

    const currentY = e.touches[0].clientY
    const deltaY = currentY - cardDragStartYRef.current
    const absDeltaY = Math.abs(deltaY)

    if (cardState === 'open' && cardDragStartStateRef.current === 'open') {
      const scrollTop = cardEl.scrollTop
      const scrollHeight = cardEl.scrollHeight
      const clientHeight = cardEl.clientHeight
      const canScroll = scrollHeight > clientHeight

      if (canScroll && scrollTop > 10) {
        isDraggingCardRef.current = false
        cardEl.classList.remove('is-dragging')
        cardEl.style.removeProperty('--drag-height')
        return
      }

      if (scrollTop <= 10) {
        if (deltaY > 0) {
          // Dragging down to close - proceed
        } else if (absDeltaY < 10) {
          if (deltaY <= 0) {
            isDraggingCardRef.current = false
            cardEl.classList.remove('is-dragging')
            cardEl.style.removeProperty('--drag-height')
            return
          }
        }
      }
    }

    const dragDeltaY = cardDragStartYRef.current - currentY
    const viewportHeight = window.innerHeight
    const states = ['closed', 'open']
    const stateHeights = {
      closed: 0.15,
      open: 0.9,
    }

    const startHeight = stateHeights[cardDragStartStateRef.current] * viewportHeight
    const newHeight = Math.max(
      stateHeights.closed * viewportHeight,
      Math.min(
        stateHeights.open * viewportHeight,
        startHeight + dragDeltaY
      )
    )

    const heightPercent = (newHeight / viewportHeight) * 100
    cardEl.style.setProperty('--drag-height', `${heightPercent}%`)
    cardEl.classList.add('is-dragging')

    e.preventDefault()
    e.stopPropagation()
    e.stopImmediatePropagation()
    return false
  }

  const handleCardTouchEnd = (e) => {
    if (!isDraggingCardRef.current) return

    const target = e.target
    const isNavButton = target.closest('.view-story-nav-btn') || target.closest('.view-story-bottom-nav')
    if (isNavButton) {
      isDraggingCardRef.current = false
      const cardEl = cardDragRef.current
      if (cardEl) {
        cardEl.classList.remove('is-dragging')
        cardEl.style.removeProperty('--drag-height')
      }
      return
    }

    const cardEl = cardDragRef.current
    if (!cardEl) {
      isDraggingCardRef.current = false
      return
    }

    const currentY = e.changedTouches?.[0]?.clientY || cardDragStartYRef.current
    const deltaY = cardDragStartYRef.current - currentY
    const viewportHeight = window.innerHeight

    const snapThreshold = viewportHeight * 0.25
    const states = ['closed', 'open']
    const currentStateIndex = states.indexOf(cardDragStartStateRef.current)

    let nextState = cardDragStartStateRef.current

    const isDraggingDown = deltaY < 0
    const effectiveThreshold = (cardDragStartStateRef.current === 'open' && isDraggingDown)
      ? viewportHeight * 0.15
      : snapThreshold

    if (Math.abs(deltaY) > effectiveThreshold) {
      if (deltaY > 0 && currentStateIndex < states.length - 1) {
        nextState = states[currentStateIndex + 1]
      } else if (deltaY < 0 && currentStateIndex > 0) {
        nextState = states[currentStateIndex - 1]
      }
    } else if (cardDragStartStateRef.current === 'open' && isDraggingDown && Math.abs(deltaY) > 20) {
      nextState = 'closed'
    }

    cardEl.classList.remove('is-dragging')
    cardEl.style.removeProperty('--drag-height')

    setCardState(nextState)
    isDraggingCardRef.current = false

    e.preventDefault()
    e.stopPropagation()
    e.stopImmediatePropagation()
    return false
  }

  const handleCardTouchCancel = (e) => {
    const cardEl = cardDragRef.current
    if (cardEl) {
      cardEl.classList.remove('is-dragging')
      cardEl.style.removeProperty('--drag-height')
    }
    isDraggingCardRef.current = false
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  return {
    cardState,
    setCardState,
    cardDragRef,
    handlers: {
      onTouchStart: handleCardTouchStart,
      onTouchMove: handleCardTouchMove,
      onTouchEnd: handleCardTouchEnd,
      onTouchCancel: handleCardTouchCancel,
    },
  }
}

