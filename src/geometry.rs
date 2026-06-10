use crate::math::sqr;
use crate::projections::{canonical_lat_long_to_disc, ProjectionId};
use crate::vector::Vec3;

pub fn point_on_fe(
    lat_deg: f64,
    lon_deg: f64,
    fe_radius: f64,
    active_projection: Option<ProjectionId>,
) -> Vec3 {
    let p = canonical_lat_long_to_disc(lat_deg, lon_deg, fe_radius, active_projection);
    Vec3::new(p.x, p.y, 0.0)
}

pub fn point_on_fe_map(
    lat_deg: f64,
    lon_deg: f64,
    fe_radius: f64,
    projection: ProjectionId,
) -> Vec3 {
    projection.project(lat_deg, lon_deg, fe_radius)
}

pub fn fe_lat_long_to_global_fe_coord(
    lat_deg: f64,
    lon_deg: f64,
    fe_radius: f64,
    active_projection: Option<ProjectionId>,
) -> Vec3 {
    point_on_fe(lat_deg, lon_deg, fe_radius, active_projection)
}

pub fn celest_lat_long_to_vault_coord(
    lat_deg: f64,
    lon_deg: f64,
    dome_size: f64,
    dome_height: f64,
    fe_radius: f64,
    floor: f64,
    seasonal_band: f64,
    active_projection: Option<ProjectionId>,
) -> Vec3 {
    let dome_radius = dome_size * fe_radius;
    let p = canonical_lat_long_to_disc(lat_deg, lon_deg, fe_radius, active_projection);
    let r = (p.x * p.x + p.y * p.y).sqrt();

    let z = if seasonal_band > 0.0 {
        let clamped = lat_deg.clamp(-seasonal_band, seasonal_band);
        let norm = 0.5 + 0.5 * (clamped / seasonal_band);
        let headroom = 0.12;
        let mix = headroom + (1.0 - 2.0 * headroom) * norm;
        floor + (dome_height - floor) * mix
    } else {
        let z_sq = sqr(dome_radius) - sqr(r);
        floor + if z_sq > 0.0 { z_sq.sqrt() } else { 0.0 } * (dome_height - floor)
            / dome_radius
    };

    Vec3::new(p.x, p.y, z)
}

pub fn vault_coord_at(
    lat_deg: f64,
    lon_deg: f64,
    z: f64,
    fe_radius: f64,
    active_projection: Option<ProjectionId>,
) -> Vec3 {
    let p = canonical_lat_long_to_disc(lat_deg, lon_deg, fe_radius, active_projection);
    Vec3::new(p.x, p.y, z)
}

pub fn heavenly_vault_ceiling(
    lat_deg: f64,
    dome_size: f64,
    dome_height: f64,
    fe_radius: f64,
) -> f64 {
    let r = fe_radius * (90.0 - lat_deg) / 180.0;
    let dome_r = dome_size * fe_radius;
    let rho_sq = (r * r) / (dome_r * dome_r);
    if rho_sq >= 1.0 {
        0.0
    } else {
        dome_height * (1.0 - rho_sq).sqrt()
    }
}

pub fn optical_vault_project(local_globe: Vec3, radius: f64, height: f64) -> Vec3 {
    Vec3::new(
        local_globe.x * height,
        local_globe.y * radius,
        local_globe.z * radius,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn vault_at_preserves_requested_height() {
        let p = vault_coord_at(0.0, 0.0, 0.42, 1.0, None);
        assert!((p.x - 0.5).abs() < 1e-12);
        assert_eq!(p.z, 0.42);
    }

    #[test]
    fn ceiling_hits_zero_at_rim() {
        assert_eq!(heavenly_vault_ceiling(-90.0, 1.0, 0.75, 1.0), 0.0);
        assert_eq!(heavenly_vault_ceiling(90.0, 1.0, 0.75, 1.0), 0.75);
    }
}
