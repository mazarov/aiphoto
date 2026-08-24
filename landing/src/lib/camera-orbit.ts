export const CAMERA_ORBIT_EDIT_KIND = "camera_orbit";
export const LOCAL_EDIT_KIND = "local_edit";

export const CAMERA_ORBIT_AZIMUTH_MAX = 60;
export const CAMERA_ORBIT_ELEVATION_MAX = 60;
export const CAMERA_ORBIT_DISTANCE_MIN = 0.75;
export const CAMERA_ORBIT_DISTANCE_MAX = 1.35;
export const CAMERA_ORBIT_ANGLE_STEP_DEG = 30;
export const CAMERA_ORBIT_DISTANCE_STEP = 0.15;

export type CameraPose = {
  azimuthDeg: number;
  elevationDeg: number;
  distanceRel: number;
};

export type CameraOrbitChipId =
  | "left"
  | "right"
  | "higher"
  | "lower"
  | "closer"
  | "farther";

export const CAMERA_ORBIT_NEUTRAL_POSE: CameraPose = {
  azimuthDeg: 0,
  elevationDeg: 0,
  distanceRel: 1,
};

/** Additive step per click. Repeat adds another step, then clamp. */
export const CAMERA_ORBIT_CHIP_STEPS: Record<CameraOrbitChipId, Partial<CameraPose>> = {
  left: { azimuthDeg: CAMERA_ORBIT_ANGLE_STEP_DEG },
  right: { azimuthDeg: -CAMERA_ORBIT_ANGLE_STEP_DEG },
  higher: { elevationDeg: CAMERA_ORBIT_ANGLE_STEP_DEG },
  lower: { elevationDeg: -CAMERA_ORBIT_ANGLE_STEP_DEG },
  closer: { distanceRel: -CAMERA_ORBIT_DISTANCE_STEP },
  farther: { distanceRel: CAMERA_ORBIT_DISTANCE_STEP },
};

export const CAMERA_ORBIT_CHIPS: Array<{
  id: CameraOrbitChipId;
  label: string;
}> = [
  { id: "left", label: "Слева" },
  { id: "right", label: "Справа" },
  { id: "higher", label: "Выше" },
  { id: "lower", label: "Ниже" },
  { id: "closer", label: "Ближе" },
  { id: "farther", label: "Дальше" },
];

export function isCameraOrbitEditKind(value: unknown): boolean {
  return String(value || "").trim() === CAMERA_ORBIT_EDIT_KIND;
}

/** Serialized orbit jobs start with this marker. Used when `edit_kind` is missing on claim. */
export function looksLikeCameraOrbitInstruction(text: string): boolean {
  return /^\s*CAMERA ORBIT\b/i.test(String(text ?? ""));
}

export type ImageGenerationMode =
  | "camera_orbit"
  | "local_edit"
  | "legacy_continuation"
  | "initial";

/**
 * Worker SSOT: classify I2I jobs from edit_kind or instruction prefix.
 * Vibe jobs stay out of orbit/local-edit so IMAGE A/B assembly is unchanged.
 */
export function resolveImageEditMode(input: {
  vibeId?: string | null;
  parentGenerationId?: string | null;
  editKind?: string | null;
  editInstruction?: string | null;
}): ImageGenerationMode {
  const parent = Boolean(String(input.parentGenerationId ?? "").trim());
  const instruction = String(input.editInstruction ?? "").trim();
  if (input.vibeId) return parent ? "legacy_continuation" : "initial";
  if (
    parent &&
    instruction &&
    (isCameraOrbitEditKind(input.editKind) || looksLikeCameraOrbitInstruction(instruction))
  ) {
    return "camera_orbit";
  }
  if (parent && instruction) return "local_edit";
  if (parent) return "legacy_continuation";
  return "initial";
}

export function parseCameraPose(raw: unknown): CameraPose | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const azimuthDeg = Number(row.azimuthDeg ?? row.azimuth_deg);
  const elevationDeg = Number(row.elevationDeg ?? row.elevation_deg);
  const distanceRel = Number(row.distanceRel ?? row.distance_rel);
  if (![azimuthDeg, elevationDeg, distanceRel].every(Number.isFinite)) {
    return null;
  }
  return { azimuthDeg, elevationDeg, distanceRel };
}

export function quantizeCameraPose(pose: CameraPose): CameraPose {
  return {
    azimuthDeg: Math.round(pose.azimuthDeg),
    elevationDeg: Math.round(pose.elevationDeg),
    distanceRel: Math.round(pose.distanceRel * 100) / 100,
  };
}

export function clampCameraPose(pose: CameraPose): CameraPose {
  return quantizeCameraPose({
    azimuthDeg: Math.min(
      CAMERA_ORBIT_AZIMUTH_MAX,
      Math.max(-CAMERA_ORBIT_AZIMUTH_MAX, pose.azimuthDeg),
    ),
    elevationDeg: Math.min(
      CAMERA_ORBIT_ELEVATION_MAX,
      Math.max(-CAMERA_ORBIT_ELEVATION_MAX, pose.elevationDeg),
    ),
    distanceRel: Math.min(
      CAMERA_ORBIT_DISTANCE_MAX,
      Math.max(CAMERA_ORBIT_DISTANCE_MIN, pose.distanceRel),
    ),
  });
}

export function isNeutralCameraPose(pose: CameraPose): boolean {
  const q = quantizeCameraPose(pose);
  return (
    q.azimuthDeg === 0 &&
    q.elevationDeg === 0 &&
    Math.abs(q.distanceRel - 1) < 0.005
  );
}

export function validateCameraPoseRange(
  pose: CameraPose,
): "ok" | "invalid_camera_pose" | "pose_unchanged" {
  if (
    !Number.isFinite(pose.azimuthDeg) ||
    !Number.isFinite(pose.elevationDeg) ||
    !Number.isFinite(pose.distanceRel) ||
    Math.abs(pose.azimuthDeg) > CAMERA_ORBIT_AZIMUTH_MAX + 0.001 ||
    Math.abs(pose.elevationDeg) > CAMERA_ORBIT_ELEVATION_MAX + 0.001 ||
    pose.distanceRel < CAMERA_ORBIT_DISTANCE_MIN - 0.001 ||
    pose.distanceRel > CAMERA_ORBIT_DISTANCE_MAX + 0.001
  ) {
    return "invalid_camera_pose";
  }
  if (isNeutralCameraPose(pose)) return "pose_unchanged";
  return "ok";
}

export function resolveSceneRootId(row: {
  id: string;
  editKind?: string | null;
  edit_kind?: string | null;
  sceneRootId?: string | null;
  scene_root_id?: string | null;
}): string {
  const kind = row.editKind ?? row.edit_kind;
  const root = String(row.sceneRootId ?? row.scene_root_id ?? "").trim();
  if (isCameraOrbitEditKind(kind) && root) return root;
  return row.id;
}

export function applyCameraOrbitChip(
  pose: CameraPose,
  chip: CameraOrbitChipId,
): CameraPose {
  const step = CAMERA_ORBIT_CHIP_STEPS[chip];
  return clampCameraPose({
    azimuthDeg: pose.azimuthDeg + (step.azimuthDeg ?? 0),
    elevationDeg: pose.elevationDeg + (step.elevationDeg ?? 0),
    distanceRel: pose.distanceRel + (step.distanceRel ?? 0),
  });
}

/** Screen-space drag: +dx = right, +dy = down. Camera-move metaphor. */
export function applyCameraOrbitDrag(
  pose: CameraPose,
  input: { dxRatio: number; dyRatio: number },
): CameraPose {
  return clampCameraPose({
    azimuthDeg: pose.azimuthDeg - input.dxRatio * 120,
    elevationDeg: pose.elevationDeg - input.dyRatio * 120,
    distanceRel: pose.distanceRel,
  });
}

/** Pinch-out (scale > 1) = closer. */
export function applyCameraOrbitPinch(pose: CameraPose, scale: number): CameraPose {
  const safe = Number.isFinite(scale) && scale > 0 ? scale : 1;
  return clampCameraPose({
    ...pose,
    distanceRel: pose.distanceRel / safe,
  });
}

export function formatCameraOrbitGhost(pose: CameraPose): string {
  const q = quantizeCameraPose(pose);
  if (isNeutralCameraPose(q)) return "Исходный ракурс";
  const parts: string[] = [];
  if (q.azimuthDeg > 0) parts.push(`Камера слева ${q.azimuthDeg}°`);
  else if (q.azimuthDeg < 0) parts.push(`Камера справа ${-q.azimuthDeg}°`);
  else parts.push("Камера по оси");

  if (q.elevationDeg > 0) parts.push(`выше ${q.elevationDeg}°`);
  else if (q.elevationDeg < 0) parts.push(`ниже ${-q.elevationDeg}°`);
  else parts.push("высота как была");

  if (q.distanceRel < 0.97) parts.push("ближе");
  else if (q.distanceRel > 1.03) parts.push("дальше");

  return parts.join(", ");
}

function orbitWalkLine(pose: CameraPose): string {
  if (pose.azimuthDeg > 0) {
    return `Walk ${pose.azimuthDeg}° LEFT around the person (orbit, not a pan).`;
  }
  if (pose.azimuthDeg < 0) {
    return `Walk ${-pose.azimuthDeg}° RIGHT around the person (orbit, not a pan).`;
  }
  return "Stay on the original left-right axis.";
}

function orbitRevealLine(pose: CameraPose): string {
  if (pose.azimuthDeg > 0) {
    return "more LEFT cheek, left ear, left shoulder, and left background";
  }
  if (pose.azimuthDeg < 0) {
    return "more RIGHT cheek, right ear, right shoulder, and right background";
  }
  return "a new silhouette via height/distance (do not keep the source outline)";
}

export function serializeCameraOrbitInstruction(pose: CameraPose): string {
  const q = clampCameraPose(pose);
  const side =
    q.azimuthDeg > 0
      ? "left of the subject"
      : q.azimuthDeg < 0
        ? "right of the subject"
        : "on the original axis";
  const height =
    q.elevationDeg > 0
      ? "higher than the source"
      : q.elevationDeg < 0
        ? "lower than the source"
        : "same height";
  const lift =
    q.elevationDeg > 0
      ? `Raise ${q.elevationDeg}° (more ceiling).`
      : q.elevationDeg < 0
        ? `Lower ${-q.elevationDeg}° (more floor).`
        : "Same height.";
  const zoom =
    q.distanceRel < 0.97
      ? `Closer (${q.distanceRel}×).`
      : q.distanceRel > 1.03
        ? `Farther (${q.distanceRel}×).`
        : "Same distance.";
  return [
    "CAMERA ORBIT (HIGHEST PRIORITY)",
    "NEW photograph of the same scene. If crop and viewpoint match the input, you FAILED.",
    `- Azimuth: ${q.azimuthDeg} degrees (${side}). ${orbitWalkLine(q)}`,
    `- Elevation: ${q.elevationDeg} degrees (${height}). ${lift}`,
    `- Distance: ${q.distanceRel}×. ${zoom}`,
    `MUST CHANGE: ${orbitRevealLine(q)}; new silhouette. Mirror selfie: rebuild room, phone, reflection; do not paste the same mirror crop.`,
    "LOCK: same person, wardrobe, set, light, expression. Body and gaze stay on the ORIGINAL world direction. Subject must NOT turn toward the new camera and must NOT make eye contact with the new lens.",
    "FORBIDDEN: new identity, restyle, or the source crop.",
  ].join("\n");
}

export function cameraOrbitFingerprintFields(
  sceneRootId: string,
  pose: CameraPose,
): {
  editKind: string;
  sceneRootId: string;
  cameraPose: CameraPose;
} {
  return {
    editKind: CAMERA_ORBIT_EDIT_KIND,
    sceneRootId,
    cameraPose: quantizeCameraPose(pose),
  };
}
