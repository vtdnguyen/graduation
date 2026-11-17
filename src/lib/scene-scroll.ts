/** Giữ document trong flow để Safari vẽ xuyên hai mép, nhưng khóa cuộn cảnh.
 * Chỉ cho cuộn trong phần tử thực sự overflow; không khóa overflow của html/body.
 */
export function lockSceneScroll() {
  const scrollers = '.inv-scroll, .wishes-content, .wish-list, .wish-message';
  const editing = () => document.activeElement instanceof HTMLElement &&
    document.activeElement.matches('input, textarea, select, [contenteditable="true"]');
  const zoomed = () => (window.visualViewport?.scale ?? 1) > 1.05;

  const canScroll = (target: EventTarget | null, delta: number) => {
    let node = target instanceof Element ? target : null;
    while (node && node !== document.body) {
      if (node instanceof HTMLElement && node.matches(scrollers)) {
        const style = getComputedStyle(node);
        const max = node.scrollHeight - node.clientHeight;
        if (/auto|scroll/.test(style.overflowY) && max > 1 &&
          (delta > 0 ? node.scrollTop < max - 1 : node.scrollTop > 1)) return true;
      }
      node = node.parentElement;
    }
    return false;
  };
  let lastY = 0;
  let singleTouch = false;
  document.addEventListener('touchstart', (event) => {
    singleTouch = event.touches.length === 1;
    if (singleTouch) lastY = event.touches[0].clientY;
  }, { passive: true });
  document.addEventListener('touchmove', (event) => {
    if (!singleTouch || event.touches.length !== 1 || zoomed()) return;
    const delta = lastY - event.touches[0].clientY;
    lastY = event.touches[0].clientY;
    if (delta && !canScroll(event.target, delta) && event.cancelable) event.preventDefault();
  }, { passive: false });
  document.addEventListener('touchend', () => { singleTouch = false; }, { passive: true });
  document.addEventListener('touchcancel', () => { singleTouch = false; }, { passive: true });
  document.addEventListener('wheel', (event) => {
    if (event.ctrlKey || zoomed()) return;
    if (!canScroll(event.target, event.deltaY) && event.cancelable) event.preventDefault();
  }, { passive: false });
  document.addEventListener('keydown', (event) => {
    if (editing() || zoomed() || event.ctrlKey || event.metaKey || event.altKey) return;
    // Space/Enter trên nút vẫn giữ hành vi kích hoạt nút bằng bàn phím.
    if ((event.target as Element | null)?.closest('button, a')) return;
    const delta = event.key === ' ' && event.shiftKey ? -1 : ['ArrowDown', 'PageDown', 'End', ' '].includes(event.key) ? 1 :
      ['ArrowUp', 'PageUp', 'Home'].includes(event.key) ? -1 : 0;
    if (delta && !canScroll(event.target, delta)) event.preventDefault();
  });

  let frame = 0;
  const align = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      // Safari được phép pan tới ô nhập/zoom; chỉ căn lại sau khi kết thúc.
      if (editing() || zoomed()) return;
      if (window.scrollY !== 0 || window.scrollX !== 0) window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    });
  };
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.addEventListener('scroll', align, { passive: true });
  window.addEventListener('resize', align);
  window.addEventListener('pageshow', align);
  window.visualViewport?.addEventListener('resize', align);
  document.addEventListener('focusout', align);
  align();
}
