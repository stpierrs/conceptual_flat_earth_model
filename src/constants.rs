pub const FE_RADIUS: f64 = 1.0;

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Geometry {
    pub vault_size_default: f64,
    pub vault_size_min: f64,
    pub vault_size_max: f64,
    pub vault_height_default: f64,
    pub vault_height_min: f64,
    pub vault_height_max: f64,
    pub camera_distance_default: f64,
    pub camera_distance_min_rel: f64,
    pub zoom_min: f64,
    pub zoom_max: f64,
    pub optical_vault_radius_far: f64,
    pub optical_vault_radius_near: f64,
    pub optical_vault_height_far: f64,
    pub optical_vault_height_near: f64,
    pub optical_vault_size_min: f64,
    pub optical_vault_size_max: f64,
    pub optical_vault_height_min: f64,
    pub optical_vault_height_max: f64,
}

pub const GEOMETRY: Geometry = Geometry {
    vault_size_default: 1.0,
    vault_size_min: 1.0,
    vault_size_max: 1.2,
    vault_height_default: 0.75,
    vault_height_min: 0.4,
    vault_height_max: 1.0,
    camera_distance_default: 10.0,
    camera_distance_min_rel: 2.0,
    zoom_min: 1.0,
    zoom_max: 10.0,
    optical_vault_radius_far: 0.5,
    optical_vault_radius_near: 0.5,
    optical_vault_height_far: 0.35,
    optical_vault_height_near: 0.35,
    optical_vault_size_min: 0.1,
    optical_vault_size_max: 1.0,
    optical_vault_height_min: 0.05,
    optical_vault_height_max: 1.0,
};

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Celestial {
    pub sidereal_day_hours: f64,
    pub sun_period_days: f64,
    pub sun_ecliptic_deg: f64,
    pub sun_angle_offset_days: f64,
    pub moon_period_days: f64,
    pub moon_ecliptic_deg: f64,
    pub moon_angle_offset_days: f64,
    pub moon_precess_period_days: f64,
    pub moon_precess_offset_days: f64,
}

pub const CELESTIAL: Celestial = Celestial {
    sidereal_day_hours: 23.93447,
    sun_period_days: 365.256363004,
    sun_ecliptic_deg: 23.44,
    sun_angle_offset_days: 78.5,
    moon_period_days: 27.321661,
    moon_ecliptic_deg: 5.145,
    moon_angle_offset_days: 0.48,
    moon_precess_period_days: -6798.383,
    moon_precess_offset_days: -301.996,
};

pub const MS_PER_DAY: f64 = 86_400_000.0;
pub const JULIAN_DAY_AT_UNIX_EPOCH: f64 = 2_440_587.5;
pub const JULIAN_DAY_AT_MODEL_ZERO: f64 = 2_457_754.5;
