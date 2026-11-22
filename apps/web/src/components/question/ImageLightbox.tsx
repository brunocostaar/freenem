import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
  type WheelEvent,
} from 'react';
import { RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';

const MIN_SCALE = 1;
const MAX_SCALE = 6;
const STEP = 1.5;

interface View {
  scale: number;
  x: number;
  y: number;
}

const RESET: View = { scale: 1, x: 0, y: 0 };

/**
 * Visualizador de imagem em tela cheia: a imagem ocupa a tela toda (ampliando
 * imagens pequenas) e aceita zoom por roda do mouse, pinça, toque duplo e
 * botões, além de arrastar para mover quando ampliada.
 */
export function ImageLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [view, setView] = useState<View>(RESET);
  const viewRef = useRef(view);
  viewRef.current = view;

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; scale: number } | null>(null);
  const moved = useRef(false);
  const lastTap = useRef(0);

  useEffect(() => {
    const el = dialogRef.current;
    if (el && !el.open) el.showModal();
  }, []);

  /** Limita o deslocamento para a imagem não sair da tela. */
  const clamp = useCallback((v: View): View => {
    const stage = stageRef.current;
    const img = imgRef.current;
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale));
    if (!stage || !img || !img.naturalWidth) return { scale, x: v.x, y: v.y };
    const cw = stage.clientWidth;
    const ch = stage.clientHeight;
    const fit = Math.min(cw / img.naturalWidth, ch / img.naturalHeight);
    const maxX = Math.max(0, (img.naturalWidth * fit * scale - cw) / 2);
    const maxY = Math.max(0, (img.naturalHeight * fit * scale - ch) / 2);
    return {
      scale,
      x: Math.min(maxX, Math.max(-maxX, v.x)),
      y: Math.min(maxY, Math.max(-maxY, v.y)),
    };
  }, []);

  /** Zoom mantendo fixo o ponto (clientX/Y) sob o cursor/dedos. */
  const zoomAt = useCallback(
    (nextScale: number, clientX?: number, clientY?: number) => {
      const stage = stageRef.current;
      const cur = viewRef.current;
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale));
      let px = 0;
      let py = 0;
      if (stage && clientX !== undefined && clientY !== undefined) {
        const r = stage.getBoundingClientRect();
        px = clientX - (r.left + r.width / 2);
        py = clientY - (r.top + r.height / 2);
      }
      const k = scale / cur.scale;
      setView(clamp({ scale, x: px - (px - cur.x) * k, y: py - (py - cur.y) * k }));
    },
    [clamp],
  );

  /** O ponto está sobre a imagem visível (em escala 1, centralizada e encaixada)? */
  function isOverImage(clientX: number, clientY: number) {
    const stage = stageRef.current;
    const img = imgRef.current;
    if (!stage || !img || !img.naturalWidth) return true;
    const r = stage.getBoundingClientRect();
    const fit = Math.min(r.width / img.naturalWidth, r.height / img.naturalHeight);
    const halfW = (img.naturalWidth * fit) / 2;
    const halfH = (img.naturalHeight * fit) / 2;
    const dx = clientX - (r.left + r.width / 2);
    const dy = clientY - (r.top + r.height / 2);
    return Math.abs(dx) <= halfW && Math.abs(dy) <= halfH;
  }

  function onWheel(e: WheelEvent) {
    zoomAt(viewRef.current.scale * Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY);
  }

  function onPointerDown(e: PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = false;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()] as [
        { x: number; y: number },
        { x: number; y: number },
      ];
      gesture.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        scale: viewRef.current.scale,
      };
    }
  }

  function onPointerMove(e: PointerEvent) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const next = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, next);
    if (Math.hypot(next.x - prev.x, next.y - prev.y) > 2) moved.current = true;

    if (pointers.current.size === 2 && gesture.current) {
      const [a, b] = [...pointers.current.values()] as [
        { x: number; y: number },
        { x: number; y: number },
      ];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      zoomAt(
        (gesture.current.scale * dist) / gesture.current.dist,
        (a.x + b.x) / 2,
        (a.y + b.y) / 2,
      );
    } else if (pointers.current.size === 1 && viewRef.current.scale > 1) {
      const cur = viewRef.current;
      setView(clamp({ ...cur, x: cur.x + next.x - prev.x, y: cur.y + next.y - prev.y }));
    }
  }

  function onPointerUp(e: PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) gesture.current = null;
    if (moved.current || pointers.current.size > 0) return;

    // toque/clique simples: duplo alterna o zoom; fora da imagem fecha
    const now = Date.now();
    if (now - lastTap.current < 300) {
      lastTap.current = 0;
      if (viewRef.current.scale > 1) setView(RESET);
      else zoomAt(2.5, e.clientX, e.clientY);
      return;
    }
    lastTap.current = now;
    if (viewRef.current.scale === 1 && !isOverImage(e.clientX, e.clientY)) onClose();
  }

  const percent = Math.round(view.scale * 100);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-label={alt ? `Imagem: ${alt}` : 'Imagem ampliada'}
      className="m-0 h-dvh max-h-none w-screen max-w-none overflow-hidden bg-black/90 p-0 text-white backdrop:bg-black/60"
    >
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-end gap-1 p-3">
        <ToolButton
          label="Diminuir zoom"
          onClick={() => zoomAt(view.scale / STEP)}
          disabled={view.scale <= MIN_SCALE}
        >
          <ZoomOut className="size-5" />
        </ToolButton>
        <span className="w-14 text-center text-sm tabular-nums" aria-live="polite">
          {percent}%
        </span>
        <ToolButton
          label="Aumentar zoom"
          onClick={() => zoomAt(view.scale * STEP)}
          disabled={view.scale >= MAX_SCALE}
        >
          <ZoomIn className="size-5" />
        </ToolButton>
        <ToolButton
          label="Tamanho original"
          onClick={() => setView(RESET)}
          disabled={view.scale === 1}
        >
          <RotateCcw className="size-5" />
        </ToolButton>
        <ToolButton label="Fechar" onClick={onClose}>
          <X className="size-6" />
        </ToolButton>
      </div>

      <div
        ref={stageRef}
        className="absolute inset-0 top-16 bottom-4 mx-4 touch-none select-none"
        style={{ cursor: view.scale > 1 ? 'grab' : 'zoom-in' }}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          draggable={false}
          className="pointer-events-none size-full object-contain will-change-transform"
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
            transition: pointers.current.size ? 'none' : 'transform 120ms ease-out',
          }}
        />
      </div>
      <p className="pointer-events-none absolute inset-x-0 bottom-1 text-center text-xs text-white/60">
        Role, faça pinça ou toque duas vezes para ampliar
      </p>
    </dialog>
  );
}

function ToolButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="grid size-10 place-items-center rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40"
    >
      {children}
    </button>
  );
}
