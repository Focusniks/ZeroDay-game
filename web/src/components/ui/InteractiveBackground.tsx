"use client";

import { useEffect, useRef, type CSSProperties } from "react";

export default function InteractiveBackground() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const targetRef = useRef({ x: 50, y: 45, cellX: 0, cellY: 0 });
  const currentRef = useRef({ x: 50, y: 45, cellX: 0, cellY: 0 });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const node = rootRef.current;
    const canvas = canvasRef.current;
    if (!node || !canvas) return;

    const cellSize = 42;
    currentRef.current.cellX = window.innerWidth / 2;
    currentRef.current.cellY = window.innerHeight / 2;
    targetRef.current.cellX = currentRef.current.cellX;
    targetRef.current.cellY = currentRef.current.cellY;

    const onMove = (event: MouseEvent) => {
      const x = (event.clientX / window.innerWidth) * 100;
      const y = (event.clientY / window.innerHeight) * 100;
      const cellX = Math.floor(event.clientX / cellSize) * cellSize + cellSize / 2;
      const cellY = Math.floor(event.clientY / cellSize) * cellSize + cellSize / 2;
      targetRef.current = { x, y, cellX, cellY };
    };

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();

    const tick = () => {
      const smooth = 0.12;
      const current = currentRef.current;
      const target = targetRef.current;

      current.x += (target.x - current.x) * smooth;
      current.y += (target.y - current.y) * smooth;
      current.cellX += (target.cellX - current.cellX) * smooth;
      current.cellY += (target.cellY - current.cellY) * smooth;

      node.style.setProperty("--mx", `${current.x}%`);
      node.style.setProperty("--my", `${current.y}%`);
      node.style.setProperty("--cell-x", `${current.cellX}px`);
      node.style.setProperty("--cell-y", `${current.cellY}px`);

      const width = window.innerWidth;
      const height = window.innerHeight;
      const radiusPx = 130;
      const radiusCells = Math.ceil(radiusPx / cellSize);
      const centerCol = Math.floor(current.cellX / cellSize);
      const centerRow = Math.floor(current.cellY / cellSize);

      ctx.clearRect(0, 0, width, height);
      for (let dy = -radiusCells; dy <= radiusCells; dy += 1) {
        for (let dx = -radiusCells; dx <= radiusCells; dx += 1) {
          const col = centerCol + dx;
          const row = centerRow + dy;
          const x = col * cellSize;
          const y = row * cellSize;
          const cx = x + cellSize / 2;
          const cy = y + cellSize / 2;
          const dist = Math.hypot(cx - current.cellX, cy - current.cellY);
          if (dist > radiusPx) continue;

          const intensity = 1 - dist / radiusPx;
          const alpha = 0.06 + intensity * 0.28;
          const blue = Math.floor(190 + intensity * 45);
          const green = Math.floor(110 + intensity * 120);
          ctx.strokeStyle = `rgba(34, ${green}, ${blue}, ${alpha.toFixed(3)})`;
          ctx.lineWidth = 1.2;
          ctx.strokeRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
        }
      }

      rafRef.current = window.requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("resize", resize);
    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize", resize);
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={
        {
          "--mx": "50%",
          "--my": "45%",
          "--cell-x": "50vw",
          "--cell-y": "50vh",
        } as CSSProperties
      }
    >
      <div className="zd-bg-base absolute inset-0" />
      <div className="zd-bg-aurora absolute inset-0" />
      <canvas ref={canvasRef} className="zd-bg-cells absolute inset-0" />
      <div className="zd-bg-grid absolute inset-0" />
    </div>
  );
}
