// URL hash <-> FeModel state. We persist the observable scalar fields
// here so you can share or reload a view and land right back where you
// were on the AE map. Right?

const PERSISTED_KEYS = [
  'ObserverLat', 'ObserverLong', 'ObserverElevation',
  'Zoom', 'OpticalZoom',
  'CameraDirection', 'CameraHeight', 'CameraDistance',
  'DateTime', 'VaultSize', 'VaultHeight',
  'OpticalVaultSize', 'OpticalVaultHeight',
  'RayParameter',
  'ShowFeGrid', 'ShowShadow', 'ShowVault', 'ShowVaultGrid', 'ShowSunTrack',
  'ShowMoonTrack', 'ShowOpticalVault', 'ShowStars', 'ShowVaultRays',
  'ShowOpticalVaultRays', 'ShowManyRays', 'ShowProjectionRays', 'ShowTruePositions',
  'ShowTropicCancer', 'ShowEquator', 'ShowTropicCapricorn',
  'ShowPolarCircles', 'ShowGroundPoints', 'ShowPlanets', 'ShowLogo',
  'ShowConstellations', 'ShowConstellationLines',
  'ShowLongitudeRing', 'ShowAzimuthRing', 'ShowOpticalVaultGrid',
  'ShowCelestialPoles', 'DarkBackground',
  'ShowLiveEphemeris', 'MoonPhaseExpanded',
  'ShowSatellites', 'ShowCelestialBodies', 'ShowCelNav',
  'ShowBlackHoles', 'ShowQuasars', 'ShowGalaxies', 'ShowCelTheo',
  'ShowGPPath', 'GPPathDays',
  'ShowSunAnalemma', 'ShowMoonAnalemma',
  'DynamicStars',
  'TimezoneOffsetMinutes',
  'StarfieldVaultHeight', 'MoonVaultHeight', 'SunVaultHeight',
  'MercuryVaultHeight', 'VenusVaultHeight', 'MarsVaultHeight',
  'JupiterVaultHeight', 'SaturnVaultHeight',
  'UranusVaultHeight', 'NeptuneVaultHeight',
  'ObserverFigure',
  'Cosmology',
  'MapProjection', 'MapProjectionGe',
  'BodySource', 'PermanentNight', 'TrackerTargets',
  'Language',
  'ShowEphemerisReadings', 'SpecifiedTrackerMode', 'TrackerGPOverride',
  'GPOverridePlanets', 'GPOverrideCelNav', 'GPOverrideConstellations',
  'GPOverrideBlackHoles', 'GPOverrideQuasars', 'GPOverrideGalaxies',
  'GPOverrideSatellites',
  'StarApplyPrecession', 'StarApplyNutation', 'StarApplyAberration',
  'StarTrepidation',
];

const STRING_KEYS = new Set([
  'ObserverFigure', 'Cosmology', 'MapProjection', 'MapProjectionGe',
  'BodySource', 'Language',
]);

// Array values are comma-joined in the URL hash.
const ARRAY_KEYS = new Set(['TrackerTargets']);

function stateToParams(state) {
  const p = new URLSearchParams();
  for (const k of PERSISTED_KEYS) {
    const v = state[k];
    if (v == null) continue;
    if (ARRAY_KEYS.has(k)) {
      if (Array.isArray(v) && v.length) p.set(k, v.join(','));
    }
    else if (typeof v === 'boolean') p.set(k, v ? '1' : '0');
    else if (typeof v === 'number') p.set(k, +v.toFixed(4));
    else p.set(k, String(v));
  }
  return p;
}

function paramsToPatch(params) {
  const patch = {};
  for (const k of PERSISTED_KEYS) {
    const s = params.get(k);
    if (s == null) continue;
    if (ARRAY_KEYS.has(k)) patch[k] = s.length ? s.split(',') : [];
    else if (STRING_KEYS.has(k)) patch[k] = s;
    else if (s === '0' || s === '1') patch[k] = s === '1';
    else patch[k] = parseFloat(s);
  }
  return patch;
}

// Bump this when a default changes so old URL hashes drop that key
// and don't carry stale values forward. Right?
const URL_SCHEMA_VERSION = '363';
const VERSION_GATED_KEYS = new Set([
  'ShowLiveEphemeris', 'MoonPhaseExpanded',
  'BodySource',
  'ObserverLat', 'ObserverLong', 'ObserverHeading',
  'CameraDirection', 'CameraHeight', 'Zoom',
  'DateTime', 'VaultHeight', 'OpticalVaultHeight',
  'RayParameter',
  'TimezoneOffsetMinutes', 'ObserverFigure',
  'ShowFeGrid', 'ShowTropicCancer', 'ShowEquator', 'ShowTropicCapricorn',
  'ShowPolarCircles', 'ShowGroundPoints',
  'ShowVault', 'ShowVaultGrid', 'ShowTruePositions', 'ShowFacingVector',
  'ShowVaultRays', 'ShowOpticalVaultRays',
  'ShowDecCircles', 'ShowLongitudeRing', 'ShowAzimuthRing',
  'ShowOpticalVaultGrid', 'ShowCelestialPoles', 'DarkBackground',
  'MapProjection', 'StarfieldType', 'PermanentNight', 'TrackerTargets',
  'MercuryVaultHeight', 'VenusVaultHeight', 'MarsVaultHeight',
  'JupiterVaultHeight', 'SaturnVaultHeight',
  'UranusVaultHeight', 'NeptuneVaultHeight',
  'MoonVaultHeight', 'SunVaultHeight',
  'OpticalZoom',
]);

export function attachUrlState(model, demos) {
  let timer = null;
  const write = () => {
    const p = stateToParams(model.state);
    p.set('v', URL_SCHEMA_VERSION);
    if (demos && demos.currentIndex >= 0) p.set('demo', String(demos.currentIndex));
    const newHash = '#' + p.toString();
    if (newHash !== window.location.hash) {
      history.replaceState(null, '', newHash);
    }
  };

  const initHash = window.location.hash.replace(/^#/, '');
  let schemaMismatch = false;
  if (initHash) {
    const params = new URLSearchParams(initHash);
    const patch = paramsToPatch(params);

    const urlV = params.get('v');
    if (urlV !== URL_SCHEMA_VERSION) {
      schemaMismatch = true;
      for (const k of VERSION_GATED_KEYS) delete patch[k];
    }

    // Drop any saved Cosmology value that's no longer valid — the
    // 'discworld' option was removed. Falls back to the model default
    // when the patch has no Cosmology key. Right?
    if (patch.Cosmology === 'discworld') {
      delete patch.Cosmology;
    }

    if (Object.keys(patch).length) model.setState(patch);
  }

  // Autoplay at ~60 Hz resets the debounce every frame — the timer
  // never settles while it's running. I mean, we need to force one
  // synchronous write on schema mismatch so the new version stamp lands.
  // Right?
  if (schemaMismatch) write();

  model.addEventListener('update', () => {
    clearTimeout(timer);
    timer = setTimeout(write, 250);
  });

  window.addEventListener('hashchange', () => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const patch = paramsToPatch(params);
    if (patch.Cosmology === 'discworld') delete patch.Cosmology;
    if (Object.keys(patch).length) model.setState(patch);
  });
}
