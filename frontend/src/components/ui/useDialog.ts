import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Open dialogs, innermost last — only the topmost one reacts to Escape and Tab. */
const dialogStack: symbol[] = [];
let scrollLocks = 0;
let previousOverflow = '';

function lockScroll() {
  if (scrollLocks === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  scrollLocks += 1;
}

function unlockScroll() {
  scrollLocks = Math.max(0, scrollLocks - 1);
  if (scrollLocks === 0) document.body.style.overflow = previousOverflow;
}

/**
 * react-datepicker renders its calendar in a portal outside the dialog. While it is open and the key comes
 * from the picker itself (its input or calendar), the key is the picker's. Once focus has moved on, the popup
 * can linger open, and Escape then belongs to the dialog again.
 */
function isDatePickerKey(event: KeyboardEvent) {
  if (!document.querySelector('.react-datepicker-popper')) return false;
  const target = event.target instanceof Element ? event.target : null;
  return Boolean(target?.closest('.react-datepicker-wrapper, .react-datepicker-popper, .react-datepicker'));
}

function focusableIn(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE))
    .filter(el => el.offsetParent !== null || el === document.activeElement);
}

export interface UseDialogOptions {
  open: boolean;
  /** Called for Escape. Omit (or pass `canClose: false`) to ignore Escape, e.g. while a request is in flight. */
  onClose?: () => void;
  canClose?: boolean;
  /** Element to focus when the dialog opens. Defaults to the first focusable element, then the dialog itself. */
  initialFocusRef?: RefObject<HTMLElement | null>;
}

/**
 * Modal dialog behaviour shared by every UGNAY dialog: moves focus in on open, keeps Tab inside, closes on
 * Escape, locks page scroll, and returns focus to whatever opened the dialog once it closes.
 * Attach the returned ref to the element with role="dialog".
 */
export function useDialog<T extends HTMLElement = HTMLDivElement>({
  open,
  onClose,
  canClose = true,
  initialFocusRef,
}: UseDialogOptions) {
  const containerRef = useRef<T>(null);
  const onCloseRef = useRef(onClose);
  const canCloseRef = useRef(canClose);
  useEffect(() => {
    onCloseRef.current = onClose;
    canCloseRef.current = canClose;
  });

  useEffect(() => {
    if (!open) return;
    const id = Symbol('dialog');
    dialogStack.push(id);
    lockScroll();
    const opener = document.activeElement as HTMLElement | null;

    const frame = requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container || container.contains(document.activeElement)) return;
      const target = initialFocusRef?.current ?? focusableIn(container)[0] ?? container;
      target.focus({ preventScroll: true });
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (dialogStack[dialogStack.length - 1] !== id) return;
      const container = containerRef.current;
      if (!container) return;

      if (event.key === 'Escape') {
        if (isDatePickerKey(event) || event.defaultPrevented) return;
        if (canCloseRef.current && onCloseRef.current) {
          event.stopPropagation();
          onCloseRef.current();
        }
        return;
      }

      if (event.key !== 'Tab' || isDatePickerKey(event)) return;
      const items = focusableIn(container);
      if (items.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!container.contains(active)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      const index = dialogStack.indexOf(id);
      if (index !== -1) dialogStack.splice(index, 1);
      unlockScroll();
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    };
    // initialFocusRef is a ref object; its identity never changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return containerRef;
}
