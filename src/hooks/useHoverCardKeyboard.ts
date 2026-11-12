'use client'

import { useCallback, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Radix marks everything inside a hover card `tabindex="-1"`, so the card's
// own actions are found by element type, not by tabindex.
const ACTIONS = 'a[href], button:not([disabled])'

const actionsIn = (root: HTMLElement | null): HTMLElement[] =>
  root ? Array.from(root.querySelectorAll<HTMLElement>(ACTIONS)) : []

/**
 * Makes a hover card usable from the keyboard.
 *
 * A Radix hover card opens on hover, but its content is portaled to the end
 * of the page and its links are taken out of the tab order, so a keyboard
 * user could never reach them. With this hook the card opens as soon as its
 * trigger has focus, and its actions sit in the tab order straight after the
 * trigger: Tab from the trigger enters the card, Tab and Shift+Tab move
 * between its actions, Tab past the last leaves for whatever follows the
 * trigger, Shift+Tab from the first returns to the trigger, and Escape closes
 * the card and returns too.
 *
 * Spread `triggerProps` on the trigger and `contentProps` on the content, and
 * pass `open` and `onOpenChange` to the HoverCard.
 */
export const useHoverCardKeyboard = <T extends HTMLElement>() => {
  const triggerRef = useRef<T>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const isEscaping = useRef(false)
  const [isHoverOpen, setHoverOpen] = useState(false)
  const [isFocusOpen, setFocusOpen] = useState(false)
  const open = isHoverOpen || isFocusOpen

  const isInside = useCallback(
    (node: Node | null) => Boolean(node && (contentRef.current?.contains(node) || triggerRef.current?.contains(node))),
    [],
  )

  const close = useCallback(() => {
    setHoverOpen(false)
    setFocusOpen(false)
  }, [])

  /** Focus the first focusable element after the trigger, outside the card. */
  const focusAfterTrigger = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const all = Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => !contentRef.current?.contains(el) && (el.offsetParent !== null || el === trigger),
    )
    const next = all[all.indexOf(trigger) + 1]
    close()
    next?.focus()
  }, [close])

  const onTriggerFocus = useCallback(() => {
    if (isEscaping.current) {
      isEscaping.current = false
      return
    }
    setFocusOpen(true)
  }, [])

  const onTriggerBlur = useCallback(
    (event: FocusEvent<T>) => {
      if (!isInside(event.relatedTarget as Node | null)) setFocusOpen(false)
    },
    [isInside],
  )

  const onTriggerKeyDown = useCallback(
    (event: KeyboardEvent<T>) => {
      if (event.key === 'Escape' && open) {
        event.preventDefault()
        close()
        return
      }
      if (event.key !== 'Tab' || event.shiftKey || !open) return
      const first = actionsIn(contentRef.current)[0]
      if (!first) return
      event.preventDefault()
      first.focus()
    },
    [open, close],
  )

  const onContentKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
        isEscaping.current = true
        triggerRef.current?.focus()
        return
      }
      if (event.key !== 'Tab') return
      const items = actionsIn(contentRef.current)
      const index = items.indexOf(document.activeElement as HTMLElement)
      event.preventDefault()
      if (event.shiftKey) {
        if (index > 0) items[index - 1].focus()
        else triggerRef.current?.focus()
      } else if (index >= 0 && index < items.length - 1) {
        items[index + 1].focus()
      } else {
        focusAfterTrigger()
      }
    },
    [close, focusAfterTrigger],
  )

  const onContentBlur = useCallback(
    (event: FocusEvent<HTMLDivElement>) => {
      if (!isInside(event.relatedTarget as Node | null)) setFocusOpen(false)
    },
    [isInside],
  )

  return {
    open,
    onOpenChange: setHoverOpen,
    triggerProps: { ref: triggerRef, onFocus: onTriggerFocus, onBlur: onTriggerBlur, onKeyDown: onTriggerKeyDown },
    contentProps: { ref: contentRef, onKeyDown: onContentKeyDown, onBlur: onContentBlur },
  }
}
