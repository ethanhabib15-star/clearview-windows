import { useCallback, useEffect, useRef } from "react";

const CANVAS_W = 420;
const CANVAS_H = 160;

export default function ElectronicSignatureModal({ open, onClose, onApply }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef({ x: 0, y: 0 });

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = CANVAS_W;
    const h = CANVAS_H;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#fffef8";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  useEffect(() => {
    if (!open) return;
    setupCanvas();
  }, [open, setupCanvas]);

  function pos(e) {
    const canvas = canvasRef.current;
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX ?? e.touches?.[0]?.clientX) - r.left;
    const y = (e.clientY ?? e.touches?.[0]?.clientY) - r.top;
    return { x, y };
  }

  function start(e) {
    e.preventDefault();
    drawing.current = true;
    last.current = pos(e);
  }

  function draw(e) {
    if (!drawing.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  }

  function end(e) {
    e?.preventDefault();
    drawing.current = false;
  }

  function clear() {
    setupCanvas();
  }

  function apply() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const dataUrl = canvas.toDataURL("image/png");
      onApply(dataUrl);
      onClose();
    } catch {
      onClose();
    }
  }

  if (!open) return null;

  return (
    <div
      className="sig-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sig-modal-title"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="sig-modal">
        <h2 id="sig-modal-title" className="sig-modal-title">
          Electronic signature
        </h2>
        <p className="sig-modal-hint">
          Sign with your mouse or finger. This image is stored on the invoice
          when you save.
        </p>
        <div className="sig-modal-canvas-wrap">
          <canvas
            ref={canvasRef}
            className="sig-modal-canvas"
            onMouseDown={start}
            onMouseMove={draw}
            onMouseUp={end}
            onMouseLeave={end}
            onTouchStart={start}
            onTouchMove={draw}
            onTouchEnd={end}
          />
        </div>
        <div className="sig-modal-actions">
          <button type="button" className="admin-btn admin-btn-ghost" onClick={clear}>
            Clear
          </button>
          <button type="button" className="admin-btn admin-btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="admin-btn admin-btn-primary" onClick={apply}>
            Apply signature
          </button>
        </div>
      </div>
    </div>
  );
}
