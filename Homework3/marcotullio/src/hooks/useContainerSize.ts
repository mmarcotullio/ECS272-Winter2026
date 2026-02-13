import { useEffect, useState } from "react";

export type Size = { width: number; height: number };

export function useContainerSize<T extends HTMLElement>() {
  const [node, setNode] = useState<T | null>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  useEffect(() => {
    if (!node) return;

    const ro = new ResizeObserver((entries) => {
      const cr = entries[0].contentRect;
      const width = Math.round(cr.width);
      const height = Math.round(cr.height);

      setSize((prev) =>
        prev.width === width && prev.height === height ? prev : { width, height }
      );
    });

    ro.observe(node);
    return () => ro.disconnect();
  }, [node]);

  return { ref: setNode, size };
}
