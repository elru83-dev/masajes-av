const base = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;

export const IconWhatsApp = () => (
  <svg {...base}><path d="M3.5 20.5l1.3-4A8.5 8.5 0 1 1 8 19.6z" /><path d="M9 9.2c0 3 2.4 5.6 5.6 5.8l1-1.4-2-1-1 .8a4 4 0 0 1-2.2-2.2l.8-1-1-2z" /></svg>
);
export const IconCalendar = () => (
  <svg {...base}><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M8 3v4M16 3v4M3.5 10h17" /></svg>
);
export const IconDrop = () => (
  <svg {...base}><path d="M12 3c2 3 5 5 5 9a5 5 0 0 1-10 0c0-4 3-6 5-9z" /><path d="M12 21v-4" /></svg>
);
export const IconShield = () => (
  <svg {...base}><path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" /><path d="M9 12l2 2 4-4" /></svg>
);
export const IconBed = () => (
  <svg {...base}><rect x="3" y="9" width="18" height="6" rx="2" /><path d="M6 15v4M18 15v4M8 9V7a2 2 0 0 1 2-2h4" /></svg>
);
export const IconLeaf = () => (
  <svg {...base}><path d="M5 19c0-8 6-13 14-14 0 8-5 14-13 14z" /><path d="M5 19l7-7" /></svg>
);
export const IconPin = () => (
  <svg {...base}><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
);
export const IconClock = () => (
  <svg {...base}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
);
export const IconChevron = ({ left = false }: { left?: boolean }) => (
  <svg {...base}><path d={left ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} /></svg>
);
export const IconMail = () => (
  <svg {...base}><rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path d="M4 7.5l8 5.5 8-5.5" /></svg>
);
