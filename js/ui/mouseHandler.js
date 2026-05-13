import * as THREE from 'three';

// Mouse and wheel events driving FE model state. Right?
//
// Orbit (default):
//   drag        -> CameraDirection / CameraHeight
//   ctrl + drag -> ObserverLat / ObserverLong
//   wheel       -> Zoom (multiplicative)
//
// First-person (InsideVault — looking up at the dome):
//   drag        -> ObserverHeading (yaw) / CameraHeight (pitch 0..90°)
//   ctrl + drag -> ObserverLat / ObserverLong
//   wheel       -> OpticalZoom (unit-stepped by active cadence)
//   click       -> snap heading/pitch to nearest celestial body;
//                  sets FollowTarget so we stay locked on it over time.
//                  Drag clears FollowTarget.

const ROT_INCR = 200;
const FP_LOOK_INCR = 180;
const POS_INCR = 300;
const ZOOM_STEP   = 1.1;
const FP_ZOOM_MIN = 0.2;
const FP_ZOOM_MAX = 75;      // fov_min = 75/75 = 1°
const CLICK_DRAG_PX   = 4;    // pointer movement below this counts as click
const CLICK_EPS_DEG   = 0.01; // heading/pitch diff for follow setState skip
const HEAVENLY_HIT_PX = 40;   // screen-space hover radius in Heavenly / free-cam

function opticalCadenceStepDeg(fovDeg) {
  if (fovDeg >= 8) return 5;
  return 1;
}

function zoomFromFov(fovDeg) {
  return Math.max(FP_ZOOM_MIN, Math.min(FP_ZOOM_MAX, 75 / fovDeg));
}

function opticalWheelStep(currentZoom, dir) {
  const fov = Math.max(0.005, Math.min(75, 75 / currentZoom));
  const step = opticalCadenceStepDeg(fov);
  let nextFov = fov - dir * step;
  nextFov = Math.max(0.005, Math.min(75, nextFov));
  return zoomFromFov(nextFov);
}

function canvasToSkyAngles(canvas, offsetX, offsetY, state) {
  const w = canvas.clientWidth || 1;
  const h = canvas.clientHeight || 1;
  const xNdc = (offsetX / w) * 2 - 1;
  const yNdc = 1 - (offsetY / h) * 2;
  const zoom = Math.max(0.2, state.OpticalZoom || 1);
  const fovV = Math.max(0.005, Math.min(75, 75 / zoom));
  const aspect = w / h;
  const fovVRad = fovV * Math.PI / 180;
  const fovHRad = 2 * Math.atan(Math.tan(fovVRad / 2) * aspect);
  const kx = xNdc * Math.tan(fovHRad / 2);
  const ky = yNdc * Math.tan(fovVRad / 2);
  const pitchRad = (state.CameraHeight || 0) * Math.PI / 180;
  const headingDeg = state.ObserverHeading || 0;
  const cosP = Math.cos(pitchRad);
  const sinP = Math.sin(pitchRad);
  const c = cosP - ky * sinP;
  const vert = sinP + ky * cosP;
  const horizLen = Math.sqrt(c * c + kx * kx);
  const elDeg = Math.atan2(vert, horizLen) * 180 / Math.PI;
  let azDeg = headingDeg + Math.atan2(kx, c) * 180 / Math.PI;
  azDeg = ((azDeg % 360) + 360) % 360;
  return { az: azDeg, el: Math.max(-90, Math.min(90, elDeg)), fovV };
}

function angularDistance(az1, el1, az2, el2) {
  const a1 = az1 * Math.PI / 180;
  const e1 = el1 * Math.PI / 180;
  const a2 = az2 * Math.PI / 180;
  const e2 = el2 * Math.PI / 180;
  const cosA = Math.sin(e1) * Math.sin(e2)
             + Math.cos(e1) * Math.cos(e2) * Math.cos(a1 - a2);
  return Math.acos(Math.max(-1, Math.min(1, cosA))) * 180 / Math.PI;
}

function resolveTargetAngles(targetId, c) {
  if (!targetId) return null;
  if (targetId === 'sun')  return c.SunAnglesGlobe  || null;
  if (targetId === 'moon') return c.MoonAnglesGlobe || null;
  if (c.Planets && c.Planets[targetId]) return c.Planets[targetId].anglesGlobe || null;
  if (targetId.startsWith('star:')) {
    const id = targetId.slice(5);
    for (const list of [
      c.CelNavStars, c.CataloguedStars, c.BlackHoles, c.Quasars, c.Galaxies, c.CelTheoStars, c.Satellites,
    ]) {
      if (!list) continue;
      const found = list.find((x) => x.id === id);
      if (found) return found.anglesGlobe || null;
    }
  }
  return null;
}

// Matches the renderer's NightFactor logic — you know, DynamicStars or GE
// forces the fade. When stars aren't drawn during daytime, we skip them
// in hover and click too. Right?
function starsVisible(c, state) {
  if (!state.ShowStars) return false;
  const dynamic = state.DynamicStars || state.WorldModel === 'ge';
  if (!dynamic) return true;
  return (c.NightFactor || 0) > 0.01;
}

function collectClickables(c, state) {
  const out = [];
  if (c.SunAnglesGlobe)  out.push({ id: 'sun',  angles: c.SunAnglesGlobe });
  if (c.MoonAnglesGlobe) out.push({ id: 'moon', angles: c.MoonAnglesGlobe });
  if (state.ShowPlanets && c.Planets) {
    for (const [name, p] of Object.entries(c.Planets)) {
      if (p && p.anglesGlobe) out.push({ id: name, angles: p.anglesGlobe });
    }
  }
  if (starsVisible(c, state)) {
    for (const list of [
      c.CelNavStars, c.CataloguedStars, c.BlackHoles, c.Quasars, c.Galaxies, c.CelTheoStars,
    ]) {
      if (!list) continue;
      for (const s of list) {
        if (s.anglesGlobe) {
          out.push({ id: `star:${s.id}`, angles: s.anglesGlobe });
        }
      }
    }
  }
  return out;
}

// Find the closest *visible* body to where we clicked, within a
// FOV-scaled angular window. I mean, if it's below the horizon
// we're not drawing it in Optical mode, so nothing to click. Right?
function findNearestCelestial(clickAz, clickEl, c, state, fovV) {
  const threshold = Math.max(1, Math.min(8, fovV / 10));
  const candidates = collectClickables(c, state);
  const followId = state.FollowTarget || null;
  let best = null, bestD = threshold;
  for (const opt of candidates) {
    if (!opt.angles || opt.angles.elevation < 0) continue;
    const d = angularDistance(clickAz, clickEl, opt.angles.azimuth, opt.angles.elevation);
    const dEff = (followId && opt.id === followId) ? d - 0.05 : d;
    if (dEff < bestD) { bestD = dEff; best = opt; }
  }
  return best;
}

const DISPLAY_NAMES = {
  sun: 'Sun', moon: 'Moon',
  mercury: 'Mercury', venus: 'Venus', mars: 'Mars', jupiter: 'Jupiter',
  saturn: 'Saturn', uranus: 'Uranus', neptune: 'Neptune',
};

function displayNameFor(id, c) {
  if (DISPLAY_NAMES[id]) return DISPLAY_NAMES[id];
  if (id.startsWith('star:')) {
    const starId = id.slice(5);
    for (const list of [
      c.CelNavStars, c.CataloguedStars, c.BlackHoles, c.Quasars, c.Galaxies, c.CelTheoStars,
    ]) {
      if (!list) continue;
      const f = list.find((x) => x.id === starId);
      if (f && f.name) return f.name;
    }
    return starId;
  }
  return id;
}

// Bodies we can hover/click in Heavenly / free-cam view. Each entry
// carries the tracker id, its 3D position on the dome (world coords), and
// angles so the tooltip can show az/el. STM mode filters to just what's
// in TrackerTargets ∪ FollowTarget — matching the render layer rules.
// We carry up to two hit-test coords per body: `domeCoord` (the true
// vault-of-heavens position, valid when ShowTruePositions is on) and
// `opticalCoord` (the optical vault projection, valid when
// ShowOpticalVault is on and the body clears the horizon). We test
// whichever layers are active and pick the closest screen-space hit.
// That's how we let you click either layer in Heavenly / free-cam. Right?
function collectHeavenlyCandidates(c, state) {
  const stm = !!state.SpecifiedTrackerMode;
  const allow = stm
    ? new Set(Array.isArray(state.TrackerTargets) ? state.TrackerTargets : [])
    : null;
  if (stm && state.FollowTarget) allow.add(state.FollowTarget);
  const passes = (id) => !stm || allow.has(id);
  const domeOn    = state.ShowTruePositions !== false;
  const opticalOn = !!state.ShowOpticalVault;
  if (!domeOn && !opticalOn) return [];

  const pushBody = (out, id, domeCoord, opticalCoord, angles) => {
    if (!passes(id)) return;
    const above = angles && angles.elevation > 0;
    const dome = domeOn ? domeCoord : null;
    const optical = (opticalOn && above) ? opticalCoord : null;
    if (!dome && !optical) return;
    out.push({ id, domeCoord: dome, opticalCoord: optical, angles });
  };

  const out = [];
  if (c.SunVaultCoord) {
    pushBody(out, 'sun', c.SunVaultCoord, c.SunOpticalVaultCoord, c.SunAnglesGlobe);
  }
  if (c.MoonVaultCoord) {
    pushBody(out, 'moon', c.MoonVaultCoord, c.MoonOpticalVaultCoord, c.MoonAnglesGlobe);
  }
  if (state.ShowPlanets && c.Planets) {
    for (const [name, p] of Object.entries(c.Planets)) {
      if (!p || !p.vaultCoord) continue;
      pushBody(out, name, p.vaultCoord, p.opticalVaultCoord, p.anglesGlobe);
    }
  }
  if (starsVisible(c, state)) {
    for (const list of [
      c.CelNavStars, c.CataloguedStars, c.BlackHoles, c.Quasars, c.Galaxies, c.CelTheoStars, c.Satellites,
    ]) {
      if (!list) continue;
      for (const s of list) {
        const id = `star:${s.id}`;
        if (!s.vaultCoord) continue;
        pushBody(out, id, s.vaultCoord, s.opticalVaultCoord, s.anglesGlobe);
      }
    }
  }
  return out;
}

// Take a world-space point on the dome, push it through the Three.js
// camera, and get back canvas-pixel coordinates. Returns null if it's
// behind the near plane or outside NDC [-1.2, 1.2]. We force a
// matrixWorldInverse refresh so hover still works between render ticks.
function projectToCanvasPixels(coord, camera, canvas) {
  if (!camera) return null;
  const w = canvas.clientWidth || 1;
  const h = canvas.clientHeight || 1;
  camera.updateMatrixWorld();
  if (camera.matrixWorldInverse && camera.matrixWorldInverse.copy) {
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
  }
  const x = coord[0], y = coord[1], z = coord[2];
  const m = camera.matrixWorldInverse.elements;
  const p = camera.projectionMatrix.elements;
  const vx = m[0]*x + m[4]*y + m[8]*z  + m[12];
  const vy = m[1]*x + m[5]*y + m[9]*z  + m[13];
  const vz = m[2]*x + m[6]*y + m[10]*z + m[14];
  const vw = m[3]*x + m[7]*y + m[11]*z + m[15];
  const cx = p[0]*vx + p[4]*vy + p[8]*vz  + p[12]*vw;
  const cy = p[1]*vx + p[5]*vy + p[9]*vz  + p[13]*vw;
  const cz = p[2]*vx + p[6]*vy + p[10]*vz + p[14]*vw;
  const cw = p[3]*vx + p[7]*vy + p[11]*vz + p[15]*vw;
  if (cw <= 0) return null;
  const ndcX = cx / cw, ndcY = cy / cw, ndcZ = cz / cw;
  if (ndcZ >= 1 || Math.abs(ndcX) > 1.2 || Math.abs(ndcY) > 1.2) return null;
  return { x: (ndcX + 1) * 0.5 * w, y: (1 - ndcY) * 0.5 * h };
}

function findNearestInHeavenly(mouseX, mouseY, canvas, c, state, camera) {
  const candidates = collectHeavenlyCandidates(c, state);
  // When two bodies overlap — sun and moon at new moon, you know —
  // we bias toward the one we're already tracking so hover picks
  // the right one, not just whichever came first in the list.
  const followId = state.FollowTarget || null;
  let best = null, bestD = HEAVENLY_HIT_PX;
  const test = (cand, pt) => {
    if (!pt) return;
    const d = Math.hypot(pt.x - mouseX, pt.y - mouseY);
    const isFollow = followId && cand.id === followId;
    const dEff = isFollow ? d - 0.5 : d;
    if (dEff < bestD) { bestD = dEff; best = { id: cand.id, angles: cand.angles }; }
  };
  for (const cand of candidates) {
    if (cand.domeCoord) test(cand, projectToCanvasPixels(cand.domeCoord, camera, canvas));
    if (cand.opticalCoord) test(cand, projectToCanvasPixels(cand.opticalCoord, camera, canvas));
  }
  return best;
}

function ensureHoverTooltip() {
  let el = document.getElementById('celestial-hover');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'celestial-hover';
  el.style.cssText = [
    'position: absolute',
    'pointer-events: none',
    'padding: 4px 8px',
    'font: 12px/1.3 ui-monospace, Menlo, monospace',
    'color: #f4f6fa',
    'background: rgba(10, 14, 22, 0.92)',
    'border: 1px solid rgba(244, 166, 64, 0.55)',
    'border-radius: 4px',
    'z-index: 40',
    'white-space: nowrap',
    'text-shadow: 0 0 2px rgba(0, 0, 0, 0.9)',
    'display: none',
  ].join(';');
  // Name in accent orange up top, az/alt stacked below. Right?
  const styleTag = document.createElement('style');
  styleTag.textContent = `
    #celestial-hover .celestial-hover-name { color: #f4a640; font-weight: 600; margin-bottom: 2px; }
    #celestial-hover div { line-height: 1.3; }
  `;
  document.head.appendChild(styleTag);
  const view = document.getElementById('view') || document.body;
  view.appendChild(el);
  return el;
}

export function attachMouseHandler(canvas, model, renderer = null) {
  let dragging = false;
  let lastX = 0, lastY = 0;
  let downX = 0, downY = 0;
  let dragDist = 0;
  const hoverTip = ensureHoverTooltip();

  // We batch pointer-move state updates into rAF so we're not hammering
  // the full app.update pass at 90–144 Hz on touch/trackpad. I mean,
  // that dominates INP on mobile. Buffer the latest patch, flush once
  // per frame — last-write-wins on any key. Nothing visible changes;
  // we just drop the sub-frame redundancy. Right?
  let _pendingMovePatch = null;
  let _moveRafScheduled = false;
  const scheduleMovePatch = (patch) => {
    _pendingMovePatch = { ..._pendingMovePatch, ...patch };
    if (_moveRafScheduled) return;
    _moveRafScheduled = true;
    requestAnimationFrame(() => {
      _moveRafScheduled = false;
      if (_pendingMovePatch) {
        model.setState(_pendingMovePatch);
        _pendingMovePatch = null;
      }
    });
  };
  // Whatever body is under the cursor right now — the one the tooltip
  // is showing. We use this on pointer-up so the click confirms exactly
  // the body you were hovering, not a recomputed hit from a slightly
  // shifted click pixel. Right?
  let hoveredHit = null;
  const hideHover = () => {
    hoverTip.style.display = 'none';
    hoveredHit = null;
  };

  // The orange origin/anchor dot on the AE map. Press-and-move drags
  // the observer's lat/lon around the disc. A clean tap toggles
  // ObserverAtCenter. pressedOnDot arms both on pointerdown; dotDragging
  // only activates once we cross the CLICK_DRAG_PX threshold. Right?
  let pressedOnDot = false;
  let dotDragging = false;
  const _ray = new THREE.Raycaster();
  const _ndc = new THREE.Vector2();

  const cancelDotDrag = () => {
    pressedOnDot = false;
    dotDragging = false;
  };

  // Ray-cast from the canvas pixel down to the disc plane (FE)
  // or globe sphere (GE) and read back lat/lon. That's how we
  // know where on the flat earth the cursor is pointing. Right?
  const cursorToLatLon = (offsetX, offsetY) => {
    if (!renderer || !renderer.sm || !renderer.sm.camera) return null;
    const cam = renderer.sm.camera;
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    _ndc.set((offsetX / w) * 2 - 1, -((offsetY / h) * 2 - 1));
    _ray.setFromCamera(_ndc, cam);
    const isGe = model.state.WorldModel === 'ge';
    const hit = new THREE.Vector3();
    if (isGe) {
      const sphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1);
      if (!_ray.ray.intersectSphere(sphere, hit)) return null;
      const r = Math.hypot(hit.x, hit.y, hit.z) || 1;
      const lat = Math.asin(Math.max(-1, Math.min(1, hit.z / r))) * 180 / Math.PI;
      const lon = Math.atan2(hit.y, hit.x) * 180 / Math.PI;
      return { lat, lon };
    }
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    if (!_ray.ray.intersectPlane(plane, hit)) return null;
    if (model.state.WorldModel === 'dp') {
      // Dual-pole AE map inverse, centred at (0°, 0°). Standard
      // azimuthal-equidistant math: c = π·ρ, phi = asin(y·sin(c)/ρ),
      // lambda = atan2(x·sin(c), ρ·cos(c)). That's the AE map. Right?
      const rho = Math.hypot(hit.x, hit.y);
      if (rho < 1e-9) return { lat: 0, lon: 0 };
      const cAng = Math.PI * Math.min(1, rho);
      const sinC = Math.sin(cAng);
      const cosC = Math.cos(cAng);
      const lat = Math.asin(Math.max(-1, Math.min(1, hit.y * sinC / rho))) * 180 / Math.PI;
      const lon = Math.atan2(hit.x * sinC, rho * cosC) * 180 / Math.PI;
      return { lat, lon };
    }
    const r = Math.hypot(hit.x, hit.y);
    const lat = Math.max(-90, Math.min(90, 90 - 180 * r));
    const lon = Math.atan2(hit.y, hit.x) * 180 / Math.PI;
    return { lat, lon };
  };

  // Check if the cursor is hovering the origin or anchor dot on the map.
  const overOrangeDot = (offsetX, offsetY) => {
    if (!model.state.ShowAxisLine) return false;
    if (!renderer || !renderer.sm || !renderer.sm.camera) return false;
    const cam = renderer.sm.camera;
    const ptOrigin = projectToCanvasPixels([0, 0, 0], cam, canvas);
    if (ptOrigin && Math.hypot(ptOrigin.x - offsetX, ptOrigin.y - offsetY) < 22) return true;
    if (renderer._lastDotWorld) {
      const ptLast = projectToCanvasPixels(renderer._lastDotWorld, cam, canvas);
      if (ptLast && Math.hypot(ptLast.x - offsetX, ptLast.y - offsetY) < 22) return true;
    }
    return false;
  };

  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    canvas.setPointerCapture(e.pointerId);
    lastX = e.offsetX; lastY = e.offsetY;
    downX = e.offsetX; downY = e.offsetY;
    dragDist = 0;
    // Arm the orange-dot interaction. Drag past CLICK_DRAG_PX promotes
    // to a full drag; releasing short of that is a tap — toggles
    // ObserverAtCenter on the AE map. Right?
    if (overOrangeDot(e.offsetX, e.offsetY)) {
      pressedOnDot = true;
    }
  });

  canvas.addEventListener('pointerup', (e) => {
    const wasClick = dragging && dragDist < CLICK_DRAG_PX;
    const wasDotDrag = dotDragging;
    const wasDotClick = pressedOnDot && wasClick;
    dragging = false;
    try { canvas.releasePointerCapture(e.pointerId); } catch {}
    cancelDotDrag();
    if (wasDotDrag) return;
    if (wasDotClick) {
      model.setState({
        ObserverAtCenter: !model.state.ObserverAtCenter,
        FollowTarget: null, FreeCamActive: false,
      });
      return;
    }
    if (!wasClick) return;
    // Use the body whose tooltip was showing — that's what the user
    // clicked on. Don't re-search from scratch; another body might
    // score slightly closer to the exact pixel. Right?
    let best = hoveredHit;
    if (!best && model.state.InsideVault) {
      const click = canvasToSkyAngles(canvas, e.offsetX, e.offsetY, model.state);
      best = findNearestCelestial(
        click.az, click.el, model.computed, model.state, click.fovV,
      );
    }
    if (!best) return;
    if (model.state.InsideVault) {
      const targetHeading = ((best.angles.azimuth % 360) + 360) % 360;
      const targetPitch = Math.max(0, Math.min(89.9, best.angles.elevation));
      model.setState({
        FollowTarget: best.id,
        ObserverHeading: targetHeading,
        CameraHeight:    targetPitch,
      });
    } else {
      // Heavenly / free-cam click: we lock on without changing Optical
      // pitch. scene.js recenters the orbit on the body's GP when
      // FreeCamActive is on. ObserverHeading snaps to the target's
      // azimuth right now so the avatar faces it immediately. Right?
      const targetHeading = ((best.angles.azimuth % 360) + 360) % 360;
      model.setState({
        FollowTarget:    best.id,
        FreeCamActive:   true,
        ObserverHeading: targetHeading,
        CameraHeight:    80.3,
        CameraDistance:  10,
        Zoom:            4.67,
      });
    }
  });

  canvas.addEventListener('pointerleave', () => {
    hideHover();
    if (model.state.MouseElevation !== null
        || model.state.MouseAzimuth !== null) {
      model.setState({ MouseElevation: null, MouseAzimuth: null });
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;

    if (dragging) {
      dragDist = Math.max(dragDist, Math.hypot(e.offsetX - downX, e.offsetY - downY));
      // Once we cross the click threshold, promote the dot press to a drag.
      if (pressedOnDot && !dotDragging && dragDist > CLICK_DRAG_PX) {
        dotDragging = true;
      }
    }

    // Dragging the orange dot — project the cursor onto the disc plane
    // (or globe sphere) and move the observer's lat/lon. The anchor
    // dot follows in real time through the renderer. Right?
    if (dotDragging) {
      const ll = cursorToLatLon(e.offsetX, e.offsetY);
      if (ll) {
        scheduleMovePatch({ ObserverLat: ll.lat, ObserverLong: ll.lon });
      }
      return;
    }

    // Hover tooltip for the orange dot — we call it "Fictitious Teleport"
    // because, I mean, you're teleporting on a flat map. Right? We check
    // this before the celestial-hover branches so it always wins.
    if (!dragging && model.state.ShowAxisLine
        && renderer && renderer.sm && renderer.sm.camera) {
      const cam = renderer.sm.camera;
      const ptOrigin = projectToCanvasPixels([0, 0, 0], cam, canvas);
      let near = ptOrigin && Math.hypot(ptOrigin.x - e.offsetX, ptOrigin.y - e.offsetY) < 22;
      if (!near && renderer._lastDotWorld) {
        const ptLast = projectToCanvasPixels(renderer._lastDotWorld, cam, canvas);
        near = ptLast && Math.hypot(ptLast.x - e.offsetX, ptLast.y - e.offsetY) < 22;
      }
      if (near) {
        hoverTip.innerHTML = `<div class="celestial-hover-name">Fictitious Teleport</div>`
          + `<div>Click to swap · hold + drag to move</div>`;
        hoverTip.style.left = `${e.offsetX + 14}px`;
        hoverTip.style.top  = `${e.offsetY + 14}px`;
        hoverTip.style.display = '';
        return;
      }
    }

    // Live cursor elevation and azimuth readout — Optical mode only.
    if (model.state.InsideVault) {
      const sky = canvasToSkyAngles(canvas, e.offsetX, e.offsetY, model.state);
      if (model.state.MouseElevation !== sky.el
          || model.state.MouseAzimuth !== sky.az) {
        scheduleMovePatch({ MouseElevation: sky.el, MouseAzimuth: sky.az });
      }
      // Hover tooltip: if the cursor is within our angular threshold of
      // a body on the dome, we float its name + az/el next to the cursor.
      // We skip this while dragging so it doesn't chase pans. Right?
      if (!dragging) {
        const hit = findNearestCelestial(
          sky.az, sky.el, model.computed, model.state, sky.fovV,
        );
        if (hit) {
          hoveredHit = hit;
          const name = displayNameFor(hit.id, model.computed);
          const az = ((hit.angles.azimuth % 360) + 360) % 360;
          const el = hit.angles.elevation;
          hoverTip.innerHTML =
            `<div class="celestial-hover-name">${name}</div>`
            + `<div>Azi: ${az.toFixed(2)}°</div>`
            + `<div>Alt: ${(el >= 0 ? '+' : '') + el.toFixed(2)}°</div>`;
          hoverTip.style.left = `${e.offsetX + 14}px`;
          hoverTip.style.top  = `${e.offsetY + 14}px`;
          hoverTip.style.display = '';
        } else {
          hideHover();
        }
      } else {
        hideHover();
      }
    } else {
      // In Heavenly / free-cam we use the screen-space projection of
      // each body's vault position, not pinhole az/el angles. Right?
      if (model.state.MouseElevation !== null
          || model.state.MouseAzimuth !== null) {
        scheduleMovePatch({ MouseElevation: null, MouseAzimuth: null });
      }
      if (!dragging) {
        const camera = window.renderer?.sm?.camera || null;
        const hit = findNearestInHeavenly(
          e.offsetX, e.offsetY, canvas, model.computed, model.state, camera,
        );
        if (hit) {
          hoveredHit = hit;
          const name = displayNameFor(hit.id, model.computed);
          const az = ((hit.angles.azimuth % 360) + 360) % 360;
          const el = hit.angles.elevation;
          hoverTip.innerHTML =
            `<div class="celestial-hover-name">${name}</div>`
            + `<div>Azi: ${az.toFixed(2)}°</div>`
            + `<div>Alt: ${(el >= 0 ? '+' : '') + el.toFixed(2)}°</div>`;
          hoverTip.style.left = `${e.offsetX + 14}px`;
          hoverTip.style.top  = `${e.offsetY + 14}px`;
          hoverTip.style.display = '';
        } else {
          hideHover();
        }
      } else {
        hideHover();
      }
    }

    if (!dragging) return;
    // While the dot press is armed but hasn't promoted yet, pin the
    // camera so it doesn't drift a few pixels before we commit to a drag.
    if (pressedOnDot) {
      lastX = e.offsetX; lastY = e.offsetY;
      return;
    }
    const dx = e.offsetX - lastX;
    const dy = e.offsetY - lastY;
    lastX = e.offsetX; lastY = e.offsetY;

    if (e.ctrlKey || e.metaKey) {
      scheduleMovePatch({
        ObserverLat: model.state.ObserverLat - (dy / w) * POS_INCR,
        ObserverLong: model.state.ObserverLong + (dx / h) * POS_INCR,
        Description: '',
      });
      return;
    }

    // Drag and zoom no longer break tracking — you can freely pan and
    // zoom while locked on a body. Use End Tracking, Escape, or a
    // cardinal button to end it explicitly. Right?

    if (model.state.InsideVault && !model.state.FreeCameraMode) {
      // Drag right = heading+, drag up = pitch+. Pitch stays 0..90°.
      const heading = model.state.ObserverHeading || 0;
      const pitch   = model.state.CameraHeight || 0;
      scheduleMovePatch({
        ObserverHeading: ((heading + (dx / w) * FP_LOOK_INCR) % 360 + 360) % 360,
        CameraHeight: Math.max(0, Math.min(90,
          pitch - (dy / h) * FP_LOOK_INCR)),
      });
      return;
    }

    // GE mode can dip the camera below the horizon to see the globe's
    // underside. FE holds a 0° floor — the flat disc has no underside
    // to look at, you know?
    const minPitch = model.state.WorldModel === 'ge' ? -89.9 : 0;
    scheduleMovePatch({
      CameraDirection: model.state.CameraDirection - (dx / w) * ROT_INCR,
      CameraHeight: Math.max(minPitch, Math.min(89.9,
        model.state.CameraHeight + (dy / h) * ROT_INCR)),
    });
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const inVault = !!model.state.InsideVault;
    if (inVault && !model.state.FreeCameraMode) {
      const cur = model.state.OpticalZoom || 5.09;
      const dir = e.deltaY > 0 ? -1 : 1;
      model.setState({ OpticalZoom: opticalWheelStep(cur, dir) });
    } else {
      const factor = e.deltaY > 0 ? 1 / ZOOM_STEP : ZOOM_STEP;
      model.setState({ Zoom: model.state.Zoom * factor });
    }
  }, { passive: false });

  // Every time the model updates — time tick, observer move, whatever —
  // we re-aim at FollowTarget. ObserverHeading updates in both Optical
  // and Heavenly so the avatar figure tracks with the body. I mean,
  // that's the whole point. CameraHeight pitch only auto-centers inside
  // Optical; Heavenly pitch stays user-controlled. Below horizon we pin
  // pitch to 0. Right?
  model.addEventListener('update', () => {
    const s = model.state;
    if (!s.FollowTarget) return;
    if (s.FreeCameraMode) return;
    if (dragging) return;
    const angles = resolveTargetAngles(s.FollowTarget, model.computed);
    if (!angles) return;
    const targetHeading = ((angles.azimuth % 360) + 360) % 360;
    const curHeading = ((s.ObserverHeading || 0) % 360 + 360) % 360;
    const patch = {};
    if (Math.abs(targetHeading - curHeading) >= CLICK_EPS_DEG) {
      patch.ObserverHeading = targetHeading;
    }
    if (s.InsideVault) {
      const targetPitch = Math.max(0, Math.min(89.9, angles.elevation));
      const curPitch = s.CameraHeight || 0;
      if (Math.abs(targetPitch - curPitch) >= CLICK_EPS_DEG) {
        patch.CameraHeight = targetPitch;
      }
    }
    if (Object.keys(patch).length > 0) model.setState(patch, false);
  });
}
