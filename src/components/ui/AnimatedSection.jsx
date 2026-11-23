import { useEffect, useRef, useState } from 'react';

export default function AnimatedSection({
  children,
  className = '',
  animation = 'slide-up',
  delay = 0,
  threshold = 0.1,
}) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold]);

  const animationClass = {
    'slide-up': 'animate-slide-up',
    'fade-in': 'animate-fade-in',
    'slide-left': 'animate-slide-in-left',
    'slide-right': 'animate-slide-in-right',
    'scale-in': 'animate-scale-in',
  }[animation];

  return (
    <div
      ref={ref}
      className={`${className} transition-all`}
      style={{
        opacity: visible ? undefined : 0,
        animationDelay: `${delay}ms`,
        animationFillMode: 'forwards',
      }}
    >
      <div className={visible ? animationClass : 'opacity-0'}>{children}</div>
    </div>
  );
}
