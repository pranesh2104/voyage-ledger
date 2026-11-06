/**
 * Elements matching `.landing-reveal` below the fold rise in once as they scroll into
 * view (styles in landing.css). Elements already on screen are left alone so nothing
 * flickers, and nothing moves for visitors who prefer reduced motion.
 *
 * Browser only. Returns a function that stops watching.
 */
export function revealOnScroll(root: HTMLElement): () => void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
    return () => {};
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const element = entry.target as HTMLElement;
        observer.unobserve(element);
        element.classList.add('landing-revealed');
        // Afterwards, hand the element back its own transitions (e.g. the cards' hover lift).
        const done = (event: TransitionEvent) => {
          if (event.target !== element) return;
          element.removeEventListener('transitionend', done);
          element.classList.remove('landing-reveal-pending', 'landing-revealed');
        };
        element.addEventListener('transitionend', done);
      }
    },
    { threshold: 0.15 },
  );

  for (const element of root.querySelectorAll<HTMLElement>('.landing-reveal')) {
    if (element.getBoundingClientRect().top < window.innerHeight) continue;
    element.classList.add('landing-reveal-pending');
    observer.observe(element);
  }
  return () => observer.disconnect();
}
