'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Scales wide content down to the width of its scroll container. Returns the
 * scale and the content's natural size, so the caller can size a wrapper to
 * the scaled box (a CSS transform does not change layout size).
 *
 * @param isEnabled - Off means scale 1: the content scrolls sideways instead
 */
export const useFitToWidth = <C extends HTMLElement, T extends HTMLElement>(isEnabled: boolean) => {
  const containerRef = useRef<C>(null)
  const contentRef = useRef<T>(null)
  const [fit, setFit] = useState({ scale: 1, width: 0, height: 0 })

  useEffect(() => {
    const container = containerRef.current
    const content = contentRef.current
    if (!container || !content) return

    const measure = () => {
      // offsetWidth/Height ignore transforms: the natural size.
      const width = content.offsetWidth
      const height = content.offsetHeight
      const available = container.clientWidth
      const scale = isEnabled && width > available && width > 0 ? available / width : 1
      setFit((prev) =>
        prev.scale === scale && prev.width === width && prev.height === height ? prev : { scale, width, height },
      )
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    observer.observe(content)
    return () => observer.disconnect()
  }, [isEnabled])

  return { containerRef, contentRef, ...fit }
}
