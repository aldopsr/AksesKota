import { m } from 'motion/react';

const EASE = [0.22, 1, 0.36, 1];

// Muncul halus saat masuk viewport. Hanya opacity + transform (ringan, tanpa layout thrash).
export function Reveal({ as = 'div', delay = 0, y = 16, className = '', children, ...rest }) {
  const Comp = m[as];
  return (
    <Comp
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -60px 0px' }}
      transition={{ duration: 0.5, ease: EASE, delay }}
      {...rest}
    >
      {children}
    </Comp>
  );
}
