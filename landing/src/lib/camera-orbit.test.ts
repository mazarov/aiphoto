import assert from "node:assert/strict";
import test from "node:test";
import {
  CAMERA_ORBIT_EDIT_KIND,
  looksLikeCameraOrbitInstruction,
  resolveImageEditMode,
  applyCameraOrbitChip,
  applyCameraOrbitDrag,
  cameraOrbitFingerprintFields,
  clampCameraPose,
  formatCameraOrbitGhost,
  isNeutralCameraPose,
  parseCameraPose,
  quantizeCameraPose,
  resolveCameraOrbitScenePrompt,
  resolveSceneRootId,
  serializeCameraOrbitInstruction,
  validateCameraPoseRange,
} from "./camera-orbit";

test("clampCameraPose and quantize stay inside v1 limits", () => {
  const clamped = clampCameraPose({
    azimuthDeg: 200,
    elevationDeg: -90,
    distanceRel: 0.2,
  });
  assert.equal(clamped.azimuthDeg, 180);
  assert.equal(clamped.elevationDeg, -60);
  assert.equal(clamped.distanceRel, 0.75);
  assert.deepEqual(
    quantizeCameraPose({ azimuthDeg: 29.4, elevationDeg: 1.6, distanceRel: 1.049 }),
    { azimuthDeg: 29, elevationDeg: 2, distanceRel: 1.05 },
  );
});

test("validateCameraPoseRange rejects NaN, overflow, and neutral", () => {
  assert.equal(
    validateCameraPoseRange({ azimuthDeg: 30, elevationDeg: 0, distanceRel: 1 }),
    "ok",
  );
  assert.equal(
    validateCameraPoseRange({ azimuthDeg: 0, elevationDeg: 0, distanceRel: 1 }),
    "pose_unchanged",
  );
  assert.equal(
    validateCameraPoseRange({ azimuthDeg: 180, elevationDeg: 0, distanceRel: 1 }),
    "ok",
  );
  assert.equal(
    validateCameraPoseRange({ azimuthDeg: 181, elevationDeg: 0, distanceRel: 1 }),
    "invalid_camera_pose",
  );
  assert.equal(
    validateCameraPoseRange({ azimuthDeg: Number.NaN, elevationDeg: 0, distanceRel: 1 }),
    "invalid_camera_pose",
  );
});

test("parseCameraPose requires three finite numbers", () => {
  assert.equal(parseCameraPose(null), null);
  assert.equal(parseCameraPose({ azimuthDeg: 10 }), null);
  assert.deepEqual(parseCameraPose({ azimuthDeg: 10, elevationDeg: -2, distanceRel: 0.9 }), {
    azimuthDeg: 10,
    elevationDeg: -2,
    distanceRel: 0.9,
  });
  assert.deepEqual(parseCameraPose({ azimuth_deg: 10, elevation_deg: -2, distance_rel: 0.9 }), {
    azimuthDeg: 10,
    elevationDeg: -2,
    distanceRel: 0.9,
  });
});

test("resolveSceneRootId walks camera children and keeps remix as root", () => {
  assert.equal(
    resolveSceneRootId({
      id: "child",
      edit_kind: CAMERA_ORBIT_EDIT_KIND,
      scene_root_id: "root",
    }),
    "root",
  );
  assert.equal(
    resolveSceneRootId({ id: "remix", edit_kind: "local_edit", scene_root_id: null }),
    "remix",
  );
  assert.equal(resolveSceneRootId({ id: "fresh" }), "fresh");
});

test("serializeCameraOrbitInstruction locks gaze and stays under 1000 chars", () => {
  const text = serializeCameraOrbitInstruction({
    azimuthDeg: 30,
    elevationDeg: 0,
    distanceRel: 1,
  });
  assert.ok(text.length <= 1000);
  assert.match(text, /CAMERA ORBIT/);
  assert.match(text, /Azimuth: 30/);
  assert.match(text, /left of the subject/);
  assert.match(text, /ORIGINAL world direction/);
  assert.match(text, /must NOT turn toward the new camera/);
  assert.match(text, /must NOT make eye contact/);
  assert.match(text, /you FAILED/);
  assert.match(text, /mirror selfie/i);
  assert.match(text, /MUST CHANGE/);
  assert.match(text, /Walk 30° LEFT/);
  assert.match(text, /LEFT cheek/);
  assert.doesNotMatch(text, /look at the new camera as a requirement/i);
  const wide = serializeCameraOrbitInstruction({
    azimuthDeg: 60,
    elevationDeg: -48,
    distanceRel: 0.75,
  });
  assert.ok(wide.length <= 1000, `orbit instruction ${wide.length} > 1000`);
  const behind = serializeCameraOrbitInstruction({
    azimuthDeg: 180,
    elevationDeg: 0,
    distanceRel: 1,
  });
  assert.match(behind, /Walk 180° LEFT/);
  assert.match(behind, /BACK of the head/);
  assert.doesNotMatch(behind, /LEFT cheek/);
});

test("resolveImageEditMode treats CAMERA ORBIT text as orbit even without edit_kind", () => {
  const instruction = serializeCameraOrbitInstruction({
    azimuthDeg: 30,
    elevationDeg: -12,
    distanceRel: 0.85,
  });
  assert.equal(looksLikeCameraOrbitInstruction(instruction), true);
  assert.equal(looksLikeCameraOrbitInstruction("Remove the scarf"), false);
  assert.equal(
    resolveImageEditMode({
      parentGenerationId: "root",
      editKind: null,
      editInstruction: instruction,
    }),
    "camera_orbit",
  );
  assert.equal(
    resolveImageEditMode({
      parentGenerationId: "root",
      editKind: "local_edit",
      editInstruction: "Remove the scarf",
    }),
    "local_edit",
  );
  assert.equal(
    resolveImageEditMode({
      vibeId: "vibe",
      parentGenerationId: "root",
      editKind: "camera_orbit",
      editInstruction: instruction,
    }),
    "legacy_continuation",
  );
  assert.equal(
    resolveImageEditMode({
      parentGenerationId: "root",
      editKind: "photoshoot",
      editInstruction: "PHOTOSHOOT\nFour-frame contact sheet from the attached photograph.",
    }),
    "photoshoot",
  );
});

test("chips add 30° per click and keep the other axes", () => {
  const start = { azimuthDeg: 0, elevationDeg: 0, distanceRel: 1 };
  const left = applyCameraOrbitChip(start, "left");
  assert.equal(left.azimuthDeg, 30);
  assert.equal(left.elevationDeg, 0);
  assert.equal(applyCameraOrbitChip(left, "left").azimuthDeg, 60);
  assert.equal(applyCameraOrbitChip(applyCameraOrbitChip(left, "left"), "left").azimuthDeg, 90);
  let wrap = start;
  for (let i = 0; i < 7; i += 1) wrap = applyCameraOrbitChip(wrap, "left");
  assert.equal(wrap.azimuthDeg, 180);
  assert.equal(applyCameraOrbitChip(left, "right").azimuthDeg, 0);
  assert.equal(applyCameraOrbitChip(start, "higher").elevationDeg, 30);
  assert.equal(applyCameraOrbitChip(applyCameraOrbitChip(start, "higher"), "higher").elevationDeg, 60);
  assert.equal(applyCameraOrbitChip(start, "closer").distanceRel, 0.85);
  assert.equal(applyCameraOrbitChip(start, "closer").azimuthDeg, 0);
});

test("drag right decreases azimuth; drag up increases elevation", () => {
  const moved = applyCameraOrbitDrag(
    { azimuthDeg: 0, elevationDeg: 0, distanceRel: 1 },
    { dxRatio: 0.25, dyRatio: -0.25 },
  );
  assert.equal(moved.azimuthDeg, -30);
  assert.equal(moved.elevationDeg, 30);
});

test("fingerprint includes quantized pose", () => {
  const first = cameraOrbitFingerprintFields("root", {
    azimuthDeg: 30.2,
    elevationDeg: 0,
    distanceRel: 1,
  });
  const second = cameraOrbitFingerprintFields("root", {
    azimuthDeg: 31,
    elevationDeg: 0,
    distanceRel: 1,
  });
  assert.equal(first.editKind, CAMERA_ORBIT_EDIT_KIND);
  assert.notDeepEqual(first, second);
  assert.deepEqual(first.cameraPose, { azimuthDeg: 30, elevationDeg: 0, distanceRel: 1 });
});

test("ghost copy is Russian and marks the source frame", () => {
  assert.equal(
    formatCameraOrbitGhost({ azimuthDeg: 0, elevationDeg: 0, distanceRel: 1 }),
    "Исходный ракурс",
  );
  assert.equal(
    formatCameraOrbitGhost({ azimuthDeg: 30, elevationDeg: 0, distanceRel: 1 }),
    "Камера слева 30°, высота как была",
  );
  assert.equal(
    formatCameraOrbitGhost({ azimuthDeg: 30, elevationDeg: 30, distanceRel: 0.85 }),
    "Камера слева 30°, выше 30°, ближе",
  );
  assert.equal(isNeutralCameraPose({ azimuthDeg: 0, elevationDeg: 0, distanceRel: 1.001 }), true);
});

test("resolveCameraOrbitScenePrompt uses the camera note and drops the card brief", () => {
  const note = serializeCameraOrbitInstruction({
    azimuthDeg: 30,
    elevationDeg: 0,
    distanceRel: 1,
  });
  const resolved = resolveCameraOrbitScenePrompt({
    promptText: "Front-on portrait facing the camera in a bathroom.",
    editInstruction: note,
    cameraPose: { azimuthDeg: 30, elevationDeg: 0, distanceRel: 1 },
  });
  assert.equal(resolved, note);
  assert.doesNotMatch(resolved, /Front-on portrait/);
  assert.equal(
    resolveCameraOrbitScenePrompt({
      promptText: note,
      editInstruction: "ignored leftover",
    }),
    note,
  );
});
