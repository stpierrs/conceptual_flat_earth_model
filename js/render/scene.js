// three.js scene, camera, and renderer setup for the flat earth model.
// World coords map straight to the FE frame — z-up, x forward, y east.
// Camera `up` is +z so all the math stays in FE coords. Right?

import * as THREE from 'three';
import { ToRad } from '../math/utils.js';
import { canonicalLatLongToDisc } from '../core/canonical.js';
import { FE_RADIUS } from '../core/constants.js';

// Given a tracker target id, we pull its ground-point { lat, lon } and
// its vault coord — where the body actually sits in 3D world space —
// using the same formulas app.update() runs. Returns null if we can't
// find the id in the current snapshot. We use the vault coord as the
// camera look-at so zooming keeps the body centred on screen, not
// the disc point underneath it. Right?
function resolveTargetGp(targetId, c) {
  if (!targetId) return null;
  const wrapLon = (x) => ((x + 180) % 360 + 360) % 360 - 180;
  if (targetId === 'sun' && c.SunCelestLatLong) {
    return {
      lat: c.SunCelestLatLong.lat,
      lon: wrapLon(c.SunRA * 180 / Math.PI - c.SkyRotAngle),
      vaultCoord: c.SunVaultCoord,
      globeVaultCoord: c.SunGlobeVaultCoord,
    };
  }
  if (targetId === 'moon' && c.MoonCelestLatLong) {
    return {
      lat: c.MoonCelestLatLong.lat,
      lon: wrapLon(c.MoonRA * 180 / Math.PI - c.SkyRotAngle),
      vaultCoord: c.MoonVaultCoord,
      globeVaultCoord: c.MoonGlobeVaultCoord,
    };
  }
  if (c.Planets && c.Planets[targetId]) {
    const p = c.Planets[targetId];
    return {
      lat: p.celestLatLong.lat,
      lon: wrapLon(p.ra * 180 / Math.PI - c.SkyRotAngle),
      vaultCoord: p.vaultCoord,
      globeVaultCoord: p.globeVaultCoord,
    };
  }
  if (targetId.startsWith('star:')) {
    const id = targetId.slice(5);
    for (const list of [
      c.CelNavStars, c.CataloguedStars, c.BlackHoles, c.Quasars, c.Galaxies,
      c.Satellites,
    ]) {
      if (!list) continue;
      const f = list.find((x) => x.id === id);
      if (f) {
        return {
          lat: f.celestLatLong.lat,
          lon: wrapLon(f.ra * 180 / Math.PI - c.SkyRotAngle),
          vaultCoord: f.vaultCoord,
          globeVaultCoord: f.globeVaultCoord,
        };
      }
    }
  }
  return null;
}

export class SceneManager {
  constructor(canvas, model) {
    this.canvas = canvas;
    this.model = model;

    this.scene = new THREE.Scene();
    // Day sky colour for when we're outside the vault in full daylight.
    // In first-person mode at night it fades to nightColor so the stars
    // and planets have something dark to read against. You know?
    this.dayColor   = new THREE.Color(0xdcecfb);
    this.nightColor = new THREE.Color(0x0d0520); // deep aetheric indigo-violet. Right?
    this.scene.background = this.dayColor.clone();

    this.camera = new THREE.PerspectiveCamera(35, 16 / 9, 0.01, 1000);
    this.camera.up.set(0, 0, 1);

    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, alpha: false,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);

    // Clip anything below the disc at z=0. That way bodies below the
    // horizon get hidden automatically — the inner celestial sphere and
    // stars don't bleed through the flat earth disc. Right?
    this.renderer.localClippingEnabled = true;
    this.clipBelowDisc = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

    this.ambient = new THREE.AmbientLight(0xffffff, 0.9);
    this.scene.add(this.ambient);
    this.sunLight = new THREE.DirectionalLight(0xffffff, 0.5);
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.world = new THREE.Group();
    this.scene.add(this.world);

    // Size pipeline: ResizeObserver gives us clean async updates,
    // but it fires after the first layout — so we seed the renderer
    // and camera synchronously with getBoundingClientRect right at
    // construction to avoid a 0×0 first frame. One forced reflow at
    // startup, not one per resize event. Much cleaner. Right?
    this._applyCanvasSize = (w, h) => {
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / Math.max(1, h);
      this.camera.updateProjectionMatrix();
    };
    {
      const r = this.canvas.getBoundingClientRect();
      this._applyCanvasSize(r.width, r.height);
    }
    if (typeof ResizeObserver !== 'undefined') {
      this._resizeObserver = new ResizeObserver((entries) => {
        const cr = entries[0]?.contentRect;
        if (!cr) return;
        this._applyCanvasSize(cr.width, cr.height);
      });
      this._resizeObserver.observe(this.canvas);
    } else {
      // Older browsers without ResizeObserver: fall back to the
      // resize-listener path, rAF-deferred so the bbox query runs
      // in a layout-clean phase instead of mid-event.
      let _resizeRaf = 0;
      const handle = () => {
        if (_resizeRaf) return;
        _resizeRaf = requestAnimationFrame(() => {
          _resizeRaf = 0;
          const r = this.canvas.getBoundingClientRect();
          this._applyCanvasSize(r.width, r.height);
        });
      };
      window.addEventListener('resize', handle);
    }
  }

  updateCamera() {
    const s = this.model.state;
    const c = this.model.computed;
    const ge = s.WorldModel === 'ge';
    const obs = ge ? (c.GlobeObserverCoord || c.ObserverFeCoord) : c.ObserverFeCoord;
    // ObserverAtCenter parks the camera at the world origin while
    // the optical-vault anchor stays at the surface lat/lon.
    // Camera math reads camObs; vault placement still uses obs. Right?
    const camObs = s.ObserverAtCenter ? [0, 0, 0] : obs;
    // The disc clip plane is FE-only — cuts world z<0 to hide anything
    // beneath the flat earth disc. GE has no flat ground plane, so we
    // turn clipping off there. Sub-horizon bodies, the cap's lower half,
    // and the back of the celestial sphere all need to render. Right?
    this.renderer.localClippingEnabled = !ge;
    // In GE InsideVault the camera sits just above the sphere surface.
    // Horizon dip is √(2h/R), so smaller h means a tighter gap at the
    // rim. We drop the near-plane way below eye-height so the sphere
    // keeps rendering at point-blank range. I mean, it has to. Right?
    const nearTarget = (ge && s.InsideVault) ? 1e-7 : 0.01;
    if (Math.abs(this.camera.near - nearTarget) > 1e-9) {
      this.camera.near = nearTarget;
      this.camera.updateProjectionMatrix();
    }
    // Expose camera aspect on model.computed so worldObjects can
    // compute horizontal FOV for the right-side elevation scale
    // without importing the camera directly. Updated every frame
    // so window resizes flow through automatically. Right?
    this.model.computed.ViewAspect = this.camera.aspect;

    // First-person mode: camera at the observer's eye height, aimed
    // along ObserverHeading. CameraHeight doubles as look pitch here
    // so the observer can tilt up toward zenith. Right?
    if (s.InsideVault && !s.FreeCameraMode) {
      // Optical FOV uses mode-local OpticalZoom, not the orbit Zoom.
      // That way switching modes doesn't bleed one zoom into the other.
      // fov = 75° / OpticalZoom, clamped. Simple. Right?
      const FOV_BASE = 75;
      const FOV_MIN  = 0.005;
      const zoom = Math.max(0.2, s.OpticalZoom || 5.09);
      const fov  = Math.max(FOV_MIN, Math.min(FOV_BASE, FOV_BASE / zoom));
      if (Math.abs(this.camera.fov - fov) > 1e-6) {
        this.camera.fov = fov;
        this.camera.updateProjectionMatrix();
      }
      // We need local north, east, and up. In GE we pull those from
      // GlobeObserverFrame — great-circle tangents plus radial-outward up.
      // In FE, "up" is world +z and north points toward the disc centre.
      // Near the pole the radial is undefined, so we fall back to the
      // meridian at ObserverLong. Right?
      let northX, northY, northZ, eastX, eastY, eastZ, upX, upY, upZ;
      if (ge && c.GlobeObserverFrame) {
        const f = c.GlobeObserverFrame;
        northX = f.northX; northY = f.northY; northZ = f.northZ;
        eastX  = f.eastX;  eastY  = f.eastY;  eastZ  = f.eastZ;
        upX    = f.upX;    upY    = f.upY;    upZ    = f.upZ;
      } else if (s.WorldModel === 'dp') {
        // DP: heading is the local meridian tangent — same axis
        // AnglesGlobe.azimuth uses, so setting ObserverHeading to a
        // body's azimuth aims the camera right at it. The heading line
        // naturally traces a diagonal because DP's meridians curve. Right?
        const lat = s.ObserverLat || 0;
        const lon = s.ObserverLong || 0;
        const eps = 1e-3;
        const pHere = canonicalLatLongToDisc(lat, lon, 1);
        const latProbe = lat >= 90 - eps ? lat - eps : lat + eps;
        const sign = lat >= 90 - eps ? -1 : 1;
        const pN = canonicalLatLongToDisc(latProbe, lon, 1);
        let dnx = (pN[0] - pHere[0]) * sign;
        let dny = (pN[1] - pHere[1]) * sign;
        let nLen = Math.hypot(dnx, dny);
        if (nLen < 1e-9) {
          const longR = ToRad(lon);
          dnx = -Math.cos(longR);
          dny = -Math.sin(longR);
          nLen = 1;
        }
        northX = dnx / nLen;
        northY = dny / nLen;
        northZ = 0;
        eastX  =  northY;
        eastY  = -northX;
        eastZ  = 0;
        upX = 0; upY = 0; upZ = 1;
      } else {
        const ox = obs[0], oy = obs[1];
        const obsLen = Math.hypot(ox, oy);
        if (obsLen > 1e-6) {
          northX = -ox / obsLen;
          northY = -oy / obsLen;
        } else {
          const longR = ToRad(s.ObserverLong || 0);
          northX = -Math.cos(longR);
          northY = -Math.sin(longR);
        }
        northZ = 0;
        eastX  =  northY;
        eastY  = -northX;
        eastZ  = 0;
        upX = 0; upY = 0; upZ = 1;
      }

      // ObserverElevation lifts the camera along local-up.
      // eyeH adds the standing eye-height offset. In GE the camera
      // hugs the sphere surface so the horizon dip is below the visual
      // threshold and sky meets ground. ObserverElevation is a flat
      // earth disc concept so we ignore it in GE. Right?
      const eyeH = ge ? 1e-6 : 0.012;
      const elev = ge ? 0 : Math.max(0, Math.min(0.5, s.ObserverElevation || 0));
      const lift = eyeH + elev;
      this.camera.position.set(
        camObs[0] + lift * upX,
        camObs[1] + lift * upY,
        camObs[2] + lift * upZ,
      );

      const h = ToRad(s.ObserverHeading || 0);
      const fx = Math.cos(h) * northX + Math.sin(h) * eastX;
      const fy = Math.cos(h) * northY + Math.sin(h) * eastY;
      const fz = Math.cos(h) * northZ + Math.sin(h) * eastZ;
      // At the disc centre there's no horizon obstruction, so we
      // allow negative pitch so they can look down and track
      // southern-hemisphere bodies too. Right?
      const pitchMin = s.ObserverAtCenter ? -89 : 0;
      const pitch = ToRad(Math.max(pitchMin, Math.min(90, s.CameraHeight || 0)));
      const cP = Math.cos(pitch), sP = Math.sin(pitch);
      const pd = 2;
      const tx = camObs[0] + eyeH * upX + (cP * fx + sP * upX) * pd;
      const ty = camObs[1] + eyeH * upY + (cP * fy + sP * upY) * pd;
      const tz = camObs[2] + eyeH * upZ + (cP * fz + sP * upZ) * pd;
      this.camera.up.set(upX, upY, upZ);
      this.camera.lookAt(tx, ty, tz);
      return;
    }

    if (this.camera.fov !== 35) {
      this.camera.fov = 35;
      this.camera.updateProjectionMatrix();
    }
    // Reset camera up for orbit mode. If we came back from GE InsideVault
    // the up vector was pointing radially outward — we need to reset it
    // so the orbit view isn't tilted. Right?
    this.camera.up.set(0, 0, 1);

    const dir = ToRad(s.CameraDirection);
    const hgt = ToRad(s.CameraHeight);
    const dist = s.CameraDistance / Math.max(0.1, s.Zoom);

    // Free-cam: orbit the tracked body's ground point instead of
    // the disc origin. Same spherical offset math, just pivoted around
    // the GP so the body stays centred on screen. Falls back to normal
    // orbit if the target can't be resolved. Right?
    if (s.FreeCamActive && s.FollowTarget && !s.FreeCameraMode) {
      const gp = resolveTargetGp(s.FollowTarget, this.model.computed);
      if (gp) {
        // We pivot on the vault coord, not the ground point, so zooming
        // keeps the body pinned on screen. Orbiting the GP made the body
        // drift as zoom changed — the GP-to-body offset became a bigger
        // fraction of the camera-pivot distance. Vault coord fixes that.
        // GE uses the globe-vault variant. Right?
        const ge = s.WorldModel === 'ge';
        const pivot = ge
          ? (gp.globeVaultCoord || gp.vaultCoord)
          : gp.vaultCoord;
        if (pivot) {
          const cx = pivot[0] + dist * Math.cos(hgt) * Math.cos(dir);
          const cy = pivot[1] + dist * Math.cos(hgt) * Math.sin(dir);
          const cz = pivot[2] + dist * Math.sin(hgt);
          this.camera.position.set(cx, cy, cz);
          this.camera.lookAt(pivot[0], pivot[1], pivot[2]);
        } else {
          const gpXY = canonicalLatLongToDisc(gp.lat, gp.lon, FE_RADIUS);
          const cx = gpXY[0] + dist * Math.cos(hgt) * Math.cos(dir);
          const cy = gpXY[1] + dist * Math.cos(hgt) * Math.sin(dir);
          const cz = 0       + dist * Math.sin(hgt);
          this.camera.position.set(cx, cy, cz);
          this.camera.lookAt(gpXY[0], gpXY[1], 0);
        }
        return;
      }
    }

    const x = dist * Math.cos(hgt) * Math.cos(dir);
    const y = dist * Math.cos(hgt) * Math.sin(dir);
    const z = dist * Math.sin(hgt);
    this.camera.position.set(x, y, z);

    if (s.FreeCameraMode) {
      // InsideVault: orbit the observer so the optical-vault dome
      // stays in frame. Heavenly: orbit the disc origin. Right?
      if (s.InsideVault) {
        this.camera.position.set(camObs[0] + x, camObs[1] + y, camObs[2] + z);
        this.camera.lookAt(camObs[0], camObs[1], camObs[2]);
      } else {
        this.camera.lookAt(0, 0, 0);
      }
      return;
    }

    const domeH = s.VaultHeight;
    const zoomParam = Math.max(0, Math.min(1, (s.Zoom - 1) / (10 - 1)));
    const tx = camObs[0] + (0 - camObs[0]) * zoomParam;
    const ty = camObs[1] + (0 - camObs[1]) * zoomParam;
    const tz = camObs[2] + (domeH * 0.5 - camObs[2]) * zoomParam;
    this.camera.lookAt(tx, ty, tz);
  }

  updateLight() {
    const s = this.model.computed.SunCelestCoord;
    this.sunLight.position.set(s[0] * 10, s[1] * 10, s[2] * 10);
    this.sunLight.target.position.set(0, 0, 0);
  }

  // Eclipse-path darkening for the observer. The renderer pushes
  // a factor each frame — 0 is unaffected, 1 is fully inside the
  // umbra. render() folds it into ambient, sunLight, and background
  // colour so the observer literally "loses the sun" when they're
  // inside the shadow path. Right?
  setEclipseDarkFactor(f) {
    this._eclipseDarkFactor = Math.max(0, Math.min(1, f || 0));
  }

  render() {
    this.updateCamera();
    this.updateLight();
    const darken = this._eclipseDarkFactor || 0;
    // Fold the eclipse darken factor into ambient and sun intensities.
    // Base values (0.9 and 0.5) multiplied by (1 − 0.85·darken) so
    // the scene never goes pitch black — the corona still glows
    // faintly during totality. Right?
    const dimAmbient = 0.9 * (1 - 0.85 * darken);
    const dimSun     = 0.5 * (1 - 0.90 * darken);
    if (Math.abs(this.ambient.intensity - dimAmbient) > 1e-4) {
      this.ambient.intensity = dimAmbient;
    }
    if (Math.abs(this.sunLight.intensity - dimSun) > 1e-4) {
      this.sunLight.intensity = dimSun;
    }
    // Inside the vault the background fades to night by NightFactor so
    // the starfield has dark sky behind it. Eclipse darken pushes
    // toward night regardless of NightFactor. DarkBackground locks
    // the scene to near-black nightColor in any mode — eclipse darken
    // still applies on top of that. Right?
    const forceDark = !!this.model.state.DarkBackground;
    if (forceDark) {
      this.scene.background.copy(this.nightColor);
    } else if (this.model.state.InsideVault) {
      const nf = Math.max(this.model.computed.NightFactor || 0, darken);
      this.scene.background.copy(this.dayColor).lerp(this.nightColor, nf);
    } else {
      // Heavenly vault mode: lerp the background toward night during
      // eclipse darken so the shadow reads on scene lighting too. Right?
      this.scene.background.copy(this.dayColor).lerp(this.nightColor, darken * 0.6);
    }
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    if (this._resizeObserver) this._resizeObserver.disconnect();
    this.renderer.dispose();
  }
}
