/**
 * Анимация «матричного дождя» символов для фона
 */
import { useEffect, useRef } from 'react';

interface MatrixRainProps {
  className?: string;
  opacity?: number;
}

export function MatrixRain({ className = '', opacity = 0.15 }: MatrixRainProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF{}[]<>/\\|=+-*&^%$#@!';
    const charArray = chars.split('');
    const fontSize = 14;
    let columns: number;
    let drops: number[];

    function resize() {
      canvas!.width = canvas!.offsetWidth;
      canvas!.height = canvas!.offsetHeight;
      columns = Math.floor(canvas!.width / fontSize);
      drops = Array(columns).fill(1).map(() => Math.random() * -100);
    }

    resize();
    window.addEventListener('resize', resize);

    function draw() {
      ctx!.fillStyle = `rgba(10, 10, 15, 0.05)`;
      ctx!.fillRect(0, 0, canvas!.width, canvas!.height);

      ctx!.fillStyle = `rgba(0, 212, 255, ${opacity})`;
      ctx!.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const text = charArray[Math.floor(Math.random() * charArray.length)];
        const x = i * fontSize;
        const y = drops[i]! * fontSize;

        // Первый символ ярче
        if (drops[i]! > 0 && drops[i]! < 3) {
          ctx!.fillStyle = `rgba(0, 255, 65, ${opacity * 2})`;
        } else {
          ctx!.fillStyle = `rgba(0, 212, 255, ${opacity})`;
        }

        ctx!.fillText(text!, x, y);

        if (y > canvas!.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i] += 0.5 + Math.random() * 0.5;
      }

      animationId = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, [opacity]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
    />
  );
}
