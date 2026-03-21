import { useEffect, useRef } from 'react';

export function useBodyScrollLock(isLocked: boolean) {
  const scrollY = useRef(0);

  useEffect(() => {
    if (!isLocked) return;

    scrollY.current = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY.current}px`;
    document.body.style.width = '100%';

    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, scrollY.current);
    };
  }, [isLocked]);
}
