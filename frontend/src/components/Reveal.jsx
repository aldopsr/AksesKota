import { m } from 'motion/react';

// Muncul halus saat masuk viewport (opacity + 8px). Tanpa parallax, tanpa stagger panjang.
export default function Reveal({ as = 'div', delay = 0, className = '', children, ...rest }) {
  const Comp = m[as];
  return (
    <Comp
      className={className}
      initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -40px 0px' }}
      transition={{ duration: 0.28, ease: [0.2, 0, 0, 1], delay }}
      {...rest}
    >
      {children}
    </Comp>
  );
}
