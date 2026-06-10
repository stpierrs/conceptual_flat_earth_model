use std::str::FromStr;

use crate::constants::{FE_RADIUS, GEOMETRY};
use crate::ephemeris::{
    equatorial_to_celest_coord, greenwich_sidereal_deg, moon_equatorial, sun_equatorial,
};
use crate::geometry::{
    fe_lat_long_to_global_fe_coord, heavenly_vault_ceiling, optical_vault_project, vault_coord_at,
};
use crate::math::{limit01, limit1, to_deg, to_rad, wrap180};
use crate::projections::ProjectionId;
use crate::time::current_model_datetime;
use crate::transforms::{
    celest_coord_to_local_globe_coord, comp_trans_mat_celest_to_globe,
    comp_trans_mat_local_fe_to_global_fe, coord_to_lat_long,
    local_globe_coord_to_angles, local_globe_coord_to_global_fe_coord, Angles, LatLong,
};
use crate::vector::Vec3;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WorldModel {
    Fe,
    Ge,
    Dp,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ParseWorldModelError;

impl WorldModel {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Fe => "fe",
            Self::Ge => "ge",
            Self::Dp => "dp",
        }
    }
}

impl FromStr for WorldModel {
    type Err = ParseWorldModelError;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "fe" => Ok(Self::Fe),
            "ge" => Ok(Self::Ge),
            "dp" => Ok(Self::Dp),
            _ => Err(ParseWorldModelError),
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct FeState {
    pub observer_lat: f64,
    pub observer_long: f64,
    pub observer_heading: f64,
    pub observer_elevation: f64,
    pub date_time: f64,
    pub vault_size: f64,
    pub vault_height: f64,
    pub optical_vault_size: f64,
    pub optical_vault_height: f64,
    pub starfield_vault_height: f64,
    pub inside_vault: bool,
    pub world_model: WorldModel,
    pub map_projection: ProjectionId,
}

impl Default for FeState {
    fn default() -> Self {
        Self {
            observer_lat: 32.0,
            observer_long: -100.8387,
            observer_heading: 357.3098,
            observer_elevation: 0.0,
            date_time: current_model_datetime(),
            vault_size: GEOMETRY.vault_size_default,
            vault_height: GEOMETRY.vault_height_default,
            optical_vault_size: GEOMETRY.optical_vault_radius_far,
            optical_vault_height: 0.5,
            starfield_vault_height: 0.564,
            inside_vault: false,
            world_model: WorldModel::Fe,
            map_projection: ProjectionId::Proportional,
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct FeModel {
    pub state: FeState,
}

impl FeModel {
    pub fn new() -> Self {
        Self {
            state: FeState::default(),
        }
    }

    pub fn with_state(state: FeState) -> Self {
        Self { state }
    }

    pub fn compute(&self) -> ComputedState {
        let s = &self.state;
        let active_projection = active_projection(s);
        let sky_rot_angle = greenwich_sidereal_deg(s.date_time);
        let observer_fe_coord = fe_lat_long_to_global_fe_coord(
            s.observer_lat,
            s.observer_long,
            FE_RADIUS,
            active_projection,
        );

        let trans_celest_to_globe =
            comp_trans_mat_celest_to_globe(s.observer_lat, s.observer_long, sky_rot_angle);
        let trans_local_fe_to_global_fe = comp_trans_mat_local_fe_to_global_fe(
            observer_fe_coord,
            s.observer_long,
            if s.world_model == WorldModel::Dp {
                Some(s.observer_lat)
            } else {
                None
            },
            active_projection,
        );

        let (optical_vault_radius, optical_vault_height) = if s.world_model == WorldModel::Ge {
            (FE_RADIUS, FE_RADIUS)
        } else {
            (s.optical_vault_size, s.optical_vault_height.min(s.vault_height))
        };
        let optical_vault_height_effective = if s.inside_vault {
            optical_vault_radius
        } else {
            optical_vault_height
        };

        let sun_eq = sun_equatorial(s.date_time);
        let moon_eq = moon_equatorial(s.date_time);

        const HEADROOM: f64 = 0.06;
        const SUN_RANGE: f64 = 0.20;
        const SUN_DEC_DEG: f64 = 23.44;
        let sun_coord = equatorial_to_celest_coord(sun_eq);
        let sun_lat_long = coord_to_lat_long(sun_coord);
        let sun_dec_norm = 0.5 + 0.5 * limit1(sun_lat_long.lat / SUN_DEC_DEG);
        let sun_ceil =
            heavenly_vault_ceiling(sun_lat_long.lat, s.vault_size, s.vault_height, FE_RADIUS);
        let sun_vault_height =
            sun_ceil.min(s.starfield_vault_height + HEADROOM + sun_dec_norm * SUN_RANGE);
        let sun = body_snapshot(BodyInput {
            name: "Sun",
            eq_ra: sun_eq.ra,
            eq_dec: sun_eq.dec,
            celest_coord: sun_coord,
            celest_lat_long: sun_lat_long,
            vault_height: sun_vault_height,
            sky_rot_angle,
            active_projection,
            trans_celest_to_globe,
            trans_local_fe_to_global_fe,
            optical_vault_radius,
            optical_vault_height_effective,
        });

        let moon_coord = equatorial_to_celest_coord(moon_eq);
        let moon_lat_long = coord_to_lat_long(moon_coord);
        let moon_ceil =
            heavenly_vault_ceiling(moon_lat_long.lat, s.vault_size, s.vault_height, FE_RADIUS);
        let moon_floor = s.starfield_vault_height + HEADROOM;
        let moon_beta_deg = ecliptic_beta_deg(moon_eq.ra, moon_eq.dec, SUN_DEC_DEG);
        let ecliptic_height_per_deg = SUN_RANGE / (2.0 * SUN_DEC_DEG);
        let moon_vault_height = moon_floor.max(
            moon_ceil.min(sun_vault_height + moon_beta_deg * ecliptic_height_per_deg),
        );
        let moon = body_snapshot(BodyInput {
            name: "Moon",
            eq_ra: moon_eq.ra,
            eq_dec: moon_eq.dec,
            celest_coord: moon_coord,
            celest_lat_long: moon_lat_long,
            vault_height: moon_vault_height,
            sky_rot_angle,
            active_projection,
            trans_celest_to_globe,
            trans_local_fe_to_global_fe,
            optical_vault_radius,
            optical_vault_height_effective,
        });

        let moon_to_globe = moon_coord.scale(-1.0).norm();
        let moon_to_sun = sun_coord.norm();
        let moon_phase = limit1(moon_to_sun.dot(moon_to_globe)).acos();
        let moon_phase_fraction = 0.5 * (1.0 + moon_phase.cos());
        let night_factor = limit01((-sun.angles_globe.elevation) / 12.0);

        ComputedState {
            date_time: s.date_time,
            active_projection,
            sky_rot_angle,
            observer_fe_coord,
            optical_vault_radius,
            optical_vault_height,
            optical_vault_height_effective,
            sun,
            moon,
            moon_phase,
            moon_phase_fraction,
            night_factor,
        }
    }
}

impl Default for FeModel {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct ComputedState {
    pub date_time: f64,
    pub active_projection: Option<ProjectionId>,
    pub sky_rot_angle: f64,
    pub observer_fe_coord: Vec3,
    pub optical_vault_radius: f64,
    pub optical_vault_height: f64,
    pub optical_vault_height_effective: f64,
    pub sun: BodySnapshot,
    pub moon: BodySnapshot,
    pub moon_phase: f64,
    pub moon_phase_fraction: f64,
    pub night_factor: f64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct BodySnapshot {
    pub name: &'static str,
    pub ra_rad: f64,
    pub dec_rad: f64,
    pub celestial_coord: Vec3,
    pub celestial_lat_long: LatLong,
    pub ground_point: LatLong,
    pub vault_height: f64,
    pub vault_coord: Vec3,
    pub local_globe_coord: Vec3,
    pub angles_globe: Angles,
    pub optical_vault_coord: Vec3,
}

#[derive(Clone, Copy)]
struct BodyInput {
    name: &'static str,
    eq_ra: f64,
    eq_dec: f64,
    celest_coord: Vec3,
    celest_lat_long: LatLong,
    vault_height: f64,
    sky_rot_angle: f64,
    active_projection: Option<ProjectionId>,
    trans_celest_to_globe: crate::matrix::Transform3,
    trans_local_fe_to_global_fe: crate::matrix::Transform3,
    optical_vault_radius: f64,
    optical_vault_height_effective: f64,
}

fn body_snapshot(input: BodyInput) -> BodySnapshot {
    let ground_lon = wrap180(input.celest_lat_long.lng - input.sky_rot_angle);
    let vault_coord = vault_coord_at(
        input.celest_lat_long.lat,
        ground_lon,
        input.vault_height,
        FE_RADIUS,
        input.active_projection,
    );
    let local_globe_coord =
        celest_coord_to_local_globe_coord(input.celest_coord, input.trans_celest_to_globe);
    let angles_globe = local_globe_coord_to_angles(local_globe_coord);
    let optical_vault_coord = local_globe_coord_to_global_fe_coord(
        optical_vault_project(
            local_globe_coord,
            input.optical_vault_radius,
            input.optical_vault_height_effective,
        ),
        input.trans_local_fe_to_global_fe,
    );

    BodySnapshot {
        name: input.name,
        ra_rad: input.eq_ra,
        dec_rad: input.eq_dec,
        celestial_coord: input.celest_coord,
        celestial_lat_long: input.celest_lat_long,
        ground_point: LatLong {
            lat: input.celest_lat_long.lat,
            lng: wrap180(to_deg(input.eq_ra) - input.sky_rot_angle),
        },
        vault_height: input.vault_height,
        vault_coord,
        local_globe_coord,
        angles_globe,
        optical_vault_coord,
    }
}

fn ecliptic_beta_deg(ra_rad: f64, dec_rad: f64, obliquity_deg: f64) -> f64 {
    let ecl_obliq_rad = to_rad(obliquity_deg);
    let beta = limit1(
        ecl_obliq_rad.cos() * dec_rad.sin()
            - ecl_obliq_rad.sin() * dec_rad.cos() * ra_rad.sin(),
    )
    .asin();
    to_deg(beta)
}

fn active_projection(state: &FeState) -> Option<ProjectionId> {
    if state.world_model == WorldModel::Dp {
        Some(ProjectionId::Dp)
    } else if state.map_projection.use_projection_grid() {
        Some(state.map_projection)
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compute_produces_finite_sun_and_moon_state() {
        let mut state = FeState::default();
        state.date_time = 0.0;
        let c = FeModel::with_state(state).compute();
        assert!(c.sky_rot_angle.is_finite());
        assert!(c.sun.angles_globe.azimuth.is_finite());
        assert!(c.sun.angles_globe.elevation.is_finite());
        assert!(c.moon.angles_globe.azimuth.is_finite());
        assert!((0.0..=1.0).contains(&c.moon_phase_fraction));
    }
}
