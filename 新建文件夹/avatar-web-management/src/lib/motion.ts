/**
 * GSAP Motion System — warm, smooth, responsive.
 * DESIGN_VARIANCE=7  MOTION_INTENSITY=6  VISUAL_DENSITY=4
 * All animations respect prefers-reduced-motion via gsap.matchMedia().
 */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

// ── Global defaults — snappy, not sluggish ────────────────
gsap.defaults({ ease: 'power2.out', duration: 0.35 });

export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── Page & Route Transitions ──────────────────────────────

/** Full page entrance — fade + subtle scale */
export const pageEnter = (el: gsap.TweenTarget) => {
  if (prefersReducedMotion()) return gsap.set(el, { opacity: 1 });
  return gsap.fromTo(el, { opacity: 0, scale: 0.98 }, { opacity: 1, scale: 1, duration: 0.3, ease: 'power2.out' });
};

/** Route change exit animation */
export const pageExit = (el: gsap.TweenTarget) => {
  if (prefersReducedMotion()) return;
  return gsap.to(el, { opacity: 0, y: -8, duration: 0.15, ease: 'power2.in' });
};

// ── Card & List Animations ────────────────────────────────

/** Card hover: lift + warm glow */
export const cardEnter = (el: Element) => {
  if (prefersReducedMotion()) return;
  gsap.to(el, { y: -4, scale: 1.015, boxShadow: '0 8px 32px rgba(217,119,6,0.1)', duration: 0.2, ease: 'power2.out' });
};
export const cardLeave = (el: Element) => {
  if (prefersReducedMotion()) return;
  gsap.to(el, { y: 0, scale: 1, boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)', duration: 0.2, ease: 'power2.out' });
};

/** Staggered list reveal */
export const staggerReveal = (els: gsap.TweenTarget, stagger = 0.05, delay = 0) => {
  if (prefersReducedMotion()) return gsap.set(els, { opacity: 1 });
  return gsap.fromTo(els, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.35, stagger, delay, ease: 'back.out(1.4)' });
};

/** Fade + slide up */
export const fadeSlideUp = (el: gsap.TweenTarget, delay = 0) => {
  if (prefersReducedMotion()) return gsap.set(el, { opacity: 1 });
  return gsap.fromTo(el, { opacity: 0, y: 32 }, { opacity: 1, y: 0, duration: 0.4, delay, ease: 'power3.out' });
};

// ── Dashboard & Data Animations ───────────────────────────

/** Counter animation (0 → N) */
export const animateCounter = (el: HTMLElement, target: number, duration = 1.0) => {
  if (prefersReducedMotion()) { el.textContent = String(target); return; }
  const obj = { val: 0 };
  gsap.to(obj, { val: target, duration, ease: 'power3.out', onUpdate: () => { el.textContent = Math.round(obj.val).toLocaleString(); } });
};

/** Dashboard widgets stagger-in */
export const dashboardReveal = (container: gsap.TweenTarget) => {
  if (prefersReducedMotion()) return;
  const widgets = (container as HTMLElement).querySelectorAll('.ant-card, [data-animate]');
  gsap.fromTo(widgets, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.08, ease: 'power2.out' });
};

// ── Scroll Animations ─────────────────────────────────────

/** Scroll-triggered reveal */
export const scrollReveal = (el: gsap.TweenTarget, delay = 0) => {
  if (typeof window === 'undefined' || prefersReducedMotion()) return gsap.set(el, { opacity: 1 });
  return gsap.fromTo(el, { opacity: 0, y: 40 },
    { opacity: 1, y: 0, duration: 0.5, delay, ease: 'power3.out',
      scrollTrigger: { trigger: el as Element, start: 'top 88%', toggleActions: 'play none none none' } });
};

// ── Modal & Overlay ───────────────────────────────────────

/** Modal entrance */
export const modalEnter = (el: gsap.TweenTarget) => {
  if (prefersReducedMotion()) return;
  return gsap.fromTo(el, { opacity: 0, scale: 0.95, y: 12 }, { opacity: 1, scale: 1, y: 0, duration: 0.25, ease: 'back.out(1.7)' });
};

/** Notification slide-in */
export const notificationEnter = (el: gsap.TweenTarget) => {
  if (prefersReducedMotion()) return;
  return gsap.fromTo(el, { opacity: 0, x: 40 }, { opacity: 1, x: 0, duration: 0.3, ease: 'power2.out' });
};

/** Tab content switch */
export const tabSwitch = (el: gsap.TweenTarget) => {
  if (prefersReducedMotion()) return;
  return gsap.fromTo(el, { opacity: 0, x: 8 }, { opacity: 1, x: 0, duration: 0.2, ease: 'power2.out' });
};

// ── Sidebar ───────────────────────────────────────────────

/** Sidebar nav items stagger in */
export const sidebarEnter = (container: HTMLElement) => {
  if (prefersReducedMotion()) return;
  const items = container.querySelectorAll('.ant-menu-item');
  gsap.fromTo(items, { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.3, stagger: 0.04, delay: 0.05, ease: 'power2.out' });
};

// ── Export GSAP for direct use ────────────────────────────
export { gsap, ScrollTrigger };
