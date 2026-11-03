import { useEffect, useState } from "react";

export function useTypewriter(value: string, speed = 18) {
  const [visibleLength, setVisibleLength] = useState(0);

  useEffect(() => {
    if (visibleLength >= value.length) return;
    const timer = window.setInterval(() => {
      setVisibleLength((current) => Math.min(current + 1, value.length));
    }, speed);
    return () => window.clearInterval(timer);
  }, [value, speed, visibleLength]);

  useEffect(() => {
    if (!value) setVisibleLength(0);
  }, [value]);

  return value.slice(0, visibleLength);
}