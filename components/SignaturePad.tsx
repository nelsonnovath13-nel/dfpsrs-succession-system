"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

const HEIGHT = 140;

export function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasDrawn = useRef(false);
  const [empty, setEmpty] = useState(true);
  const { lang } = useLanguage();
  const sw = lang === "sw";

  // The canvas's internal pixel buffer must match its actual rendered CSS size (times device
  // pixel ratio) or pointer coordinates from getBoundingClientRect() land in the wrong place --
  // this was the root cause of signing appearing broken on screens wider than the old fixed
  // 400px canvas resolution.
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    function resize() {
      const ratio = window.devicePixelRatio || 1;
      const width = container!.clientWidth;
      canvas!.width = width * ratio;
      canvas!.height = HEIGHT * ratio;
      const ctx = canvas!.getContext("2d");
      if (!ctx) return;
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#0F172A";
    }

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  function pos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const point = "touches" in e ? e.touches[0] : (e as React.MouseEvent);
    return { x: point.clientX - rect.left, y: point.clientY - rect.top };
  }

  function start(e: React.MouseEvent | React.TouchEvent) {
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }
  function move(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    hasDrawn.current = true;
    setEmpty(false);
  }
  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(hasDrawn.current ? canvasRef.current!.toDataURL("image/png") : null);
  }

  function clear() {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawn.current = false;
    setEmpty(true);
    onChange(null);
  }

  return (
    <div>
      <div ref={containerRef} className="border-2 border-gray-300 bg-white">
        <canvas
          ref={canvasRef}
          className="w-full touch-none cursor-crosshair block"
          style={{ height: HEIGHT }}
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
        />
      </div>
      <div className="flex items-center justify-between mt-1">
        <p className="text-xs text-inkSoft">{sw ? "Chora sahihi yako hapo juu" : "Draw your signature above"}</p>
        {!empty && (
          <button type="button" onClick={clear} className="text-xs text-danger inline-flex items-center gap-1">
            <Eraser size={12} aria-hidden="true" /> {sw ? "Futa" : "Clear"}
          </button>
        )}
      </div>
    </div>
  );
}
