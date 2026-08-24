"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { OVERLAY_BUTTON_UA_RESET } from "@/lib/card-overlay-action-pill";
import {
  CAMERA_ORBIT_CHIPS,
  CAMERA_ORBIT_NEUTRAL_POSE,
  applyCameraOrbitChip,
  applyCameraOrbitDrag,
  applyCameraOrbitPinch,
  formatCameraOrbitGhost,
  isNeutralCameraPose,
  type CameraOrbitChipId,
  type CameraPose,
} from "@/lib/camera-orbit";
import {
  reachYandexMetrikaGoal,
  YM_GOAL_CAMERA_ORBIT_CHIP,
  YM_GOAL_CAMERA_ORBIT_OPEN,
} from "@/lib/yandex-metrika";
import {
  GenerationResultActionRail,
  type GenerationResultAction,
} from "@/components/generate/GenerationResultActionRail";

export type CameraSceneShot = {
  id: string;
  role: "root" | "orbit";
  status: "completed";
  resultUrl: string | null;
  cameraPose: CameraPose;
  createdAt: string;
};

type Props = {
  generationId: string;
  displayedResultUrl: string;
  creditCostFallback: number;
  hideCreditCost?: boolean;
  capturing: boolean;
  progress: number;
  onClose: () => void;
  onCapture: (pose: CameraPose) => Promise<boolean>;
  onSelectShot: (shot: CameraSceneShot) => void;
};

const CHIP_ICONS: Record<CameraOrbitChipId, ReactNode> = {
  left: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M15 6 9 12l6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  right: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  higher: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="m6 15 6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  lower: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  closer: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-3.5-3.5M11 8v6M8 11h6" strokeLinecap="round" />
    </svg>
  ),
  farther: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-3.5-3.5M8 11h6" strokeLinecap="round" />
    </svg>
  ),
};

export function CameraOrbitOverlay({
  generationId,
  displayedResultUrl,
  creditCostFallback,
  hideCreditCost = false,
  capturing,
  progress,
  onClose,
  onCapture,
  onSelectShot,
}: Props) {
  const [pose, setPose] = useState<CameraPose>(CAMERA_ORBIT_NEUTRAL_POSE);
  const [shots, setShots] = useState<CameraSceneShot[]>([]);
  const [creditCost, setCreditCost] = useState(creditCostFallback);
  const [error, setError] = useState("");
  const poseRef = useRef(pose);
  const dragRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    width: number;
    height: number;
    pose: CameraPose;
  } | null>(null);
  const pinchRef = useRef<{ distance: number; pose: CameraPose } | null>(null);
  const padRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    poseRef.current = pose;
  }, [pose]);

  useEffect(() => {
    reachYandexMetrikaGoal(YM_GOAL_CAMERA_ORBIT_OPEN);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/generations/${generationId}/camera-scene`, {
          credentials: "include",
        });
        const data = (await res.json().catch(() => ({}))) as {
          shots?: CameraSceneShot[];
          displayedId?: string;
          creditCost?: number;
          error?: string;
          message?: string;
        };
        if (!res.ok) {
          throw new Error(data.message || data.error || "Не удалось загрузить сцену");
        }
        if (cancelled) return;
        const nextShots = Array.isArray(data.shots) ? data.shots : [];
        setShots(nextShots);
        if (typeof data.creditCost === "number") setCreditCost(data.creditCost);
        const current =
          nextShots.find((shot) => shot.id === data.displayedId) || nextShots[0];
        if (current) setPose(current.cameraPose);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Не удалось загрузить сцену");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [generationId]);

  const restoreRootAndClose = useCallback(() => {
    const root = shots.find((shot) => shot.role === "root") || shots[0];
    if (root?.resultUrl) onSelectShot(root);
    onClose();
  }, [onClose, onSelectShot, shots]);

  const applyKey = useCallback((event: React.KeyboardEvent) => {
    if (capturing) return;
    const stepD = 0.05;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setPose((current) => applyCameraOrbitChip(current, "left"));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      setPose((current) => applyCameraOrbitChip(current, "right"));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setPose((current) => applyCameraOrbitChip(current, "higher"));
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setPose((current) => applyCameraOrbitChip(current, "lower"));
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      setPose((current) => applyCameraOrbitPinch(current, 1 + stepD));
    } else if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      setPose((current) => applyCameraOrbitPinch(current, 1 - stepD));
    } else if (event.key === "Escape") {
      event.preventDefault();
      restoreRootAndClose();
    }
  }, [capturing, restoreRootAndClose]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (capturing || event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      width: Math.max(rect.width, 1),
      height: Math.max(rect.height, 1),
      pose: poseRef.current,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setPose(
      applyCameraOrbitDrag(drag.pose, {
        dxRatio: (event.clientX - drag.x) / drag.width,
        dyRatio: (event.clientY - drag.y) / drag.height,
      }),
    );
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  };

  const onTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 2) {
      const [a, b] = [event.touches[0], event.touches[1]];
      pinchRef.current = {
        distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
        pose: poseRef.current,
      };
    }
  };

  const onTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (capturing || event.touches.length !== 2 || !pinchRef.current) return;
    const [a, b] = [event.touches[0], event.touches[1]];
    const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    const start = pinchRef.current.distance || 1;
    setPose(applyCameraOrbitPinch(pinchRef.current.pose, distance / start));
  };

  const onTouchEnd = () => {
    pinchRef.current = null;
  };

  const handleChip = (chip: CameraOrbitChipId) => {
    if (capturing) return;
    reachYandexMetrikaGoal(YM_GOAL_CAMERA_ORBIT_CHIP, { chip });
    setPose((current) => applyCameraOrbitChip(current, chip));
  };

  const handleCapture = async () => {
    if (capturing || isNeutralCameraPose(pose)) return;
    setError("");
    const ok = await onCapture(pose);
    if (!ok) setError("");
  };

  const ctaLabel = capturing
    ? progress > 0
      ? `Снимаем… ${Math.round(progress)}%`
      : "Снимаем…"
    : hideCreditCost
      ? "Снять кадр"
      : `Снять кадр · ${creditCost}`;

  const railActions: GenerationResultAction[] = [
    ...CAMERA_ORBIT_CHIPS.map((chip) => ({
      id: chip.id,
      label: chip.label,
      disabled: capturing,
      onClick: () => handleChip(chip.id),
      icon: CHIP_ICONS[chip.id],
    })),
    {
      id: "exit",
      label: "Выйти",
      ariaLabel: "Выйти из режима камера",
      disabled: capturing,
      onClick: restoreRootAndClose,
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      id: "capture",
      label: ctaLabel,
      ariaLabel: hideCreditCost ? "Снять кадр" : `Снять кадр, ${creditCost} кредитов`,
      primary: true,
      disabled: capturing || isNeutralCameraPose(pose),
      onClick: () => void handleCapture(),
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path
            d="M4.5 8.5h2.2l1.1-2h8.4l1.1 2H19.5A1.5 1.5 0 0 1 21 10v7.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5V10a1.5 1.5 0 0 1 1.5-1.5Z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="14" r="3.1" />
        </svg>
      ),
    },
  ];

  return (
    <div
      className="absolute inset-0 z-40"
      role="dialog"
      aria-label="Ракурс"
      tabIndex={0}
      onKeyDown={applyKey}
    >
      <button
        type="button"
        aria-label="Выйти из режима камера"
        disabled={capturing}
        onClick={restoreRootAndClose}
        className={`${OVERLAY_BUTTON_UA_RESET} absolute left-3 top-[max(0.75rem,env(safe-area-inset-top))] z-30 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white shadow-lg ring-1 ring-white/25 backdrop-blur-md transition hover:bg-black/65 disabled:opacity-50`}
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      </button>

      <div
        ref={padRef}
        className="absolute inset-0 touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      />

      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-3">
        <p className="max-w-[min(100%,20rem)] rounded-full bg-black/50 px-4 py-2 text-center text-[13px] font-semibold text-white shadow-lg ring-1 ring-white/20 backdrop-blur-md">
          {formatCameraOrbitGhost(pose)}
        </p>
      </div>

      {shots.length > 0 ? (
        <div className="absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 right-[11rem] z-20 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {shots.map((shot) => {
            const active = shot.id === generationId;
            const src = shot.resultUrl || (shot.id === generationId ? displayedResultUrl : "");
            return (
              <button
                key={shot.id}
                type="button"
                disabled={capturing || !shot.resultUrl}
                onClick={() => {
                  if (!shot.resultUrl) return;
                  setPose(shot.cameraPose);
                  onSelectShot(shot);
                }}
                className={`${OVERLAY_BUTTON_UA_RESET} relative h-16 shrink-0 overflow-hidden rounded-xl ${
                  active ? "ring-2 ring-indigo-400" : "ring-1 ring-white/25"
                }`}
                style={{ width: "48px" }}
              >
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="block h-full w-full bg-white/10" />
                )}
                {shot.role === "root" ? (
                  <span className="absolute inset-x-0 bottom-0 bg-black/55 px-0.5 py-0.5 text-center text-[10px] font-semibold text-white">
                    Исходник
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {error ? (
        <p className="pointer-events-none absolute bottom-24 left-3 right-[11rem] z-20 text-center text-[13px] font-medium text-rose-200">
          {error}
        </p>
      ) : null}

      <GenerationResultActionRail
        className="absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-2.5 z-30"
        actions={railActions}
      />
    </div>
  );
}
