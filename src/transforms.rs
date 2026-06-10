use crate::math::{limit1, to_deg, to_rad};
use crate::matrix::Transform3;
use crate::projections::{canonical_lat_long_to_disc, ProjectionId};
use crate::vector::Vec3;

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct LatLong {
    pub lat: f64,
    pub lng: f64,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Angles {
    pub azimuth: f64,
    pub elevation: f64,
}

pub fn comp_trans_mat_celest_to_globe(
    obs_lat_deg: f64,
    obs_lon_deg: f64,
    sky_rot_angle_deg: f64,
) -> Transform3 {
    let first = Transform3::rotating_z(to_rad(-obs_lon_deg - sky_rot_angle_deg), None);
    Transform3::rotating_y(to_rad(obs_lat_deg), Some(first))
}

pub fn comp_trans_mat_local_fe_to_global_fe(
    observer_coord: Vec3,
    observer_lon_deg: f64,
    observer_lat_deg: Option<f64>,
    active_projection: Option<ProjectionId>,
) -> Transform3 {
    let (ax, ay, bx, by) = if let Some(observer_lat_deg) = observer_lat_deg {
        let eps = 1e-3;
        let lat = observer_lat_deg;
        let lon = observer_lon_deg;
        let p_here = canonical_lat_long_to_disc(lat, lon, 1.0, active_projection);
        let lat_probe = if lat >= 90.0 - eps { lat - eps } else { lat + eps };
        let sign = if lat >= 90.0 - eps { -1.0 } else { 1.0 };
        let p_n = canonical_lat_long_to_disc(lat_probe, lon, 1.0, active_projection);
        let dnx = (p_n.x - p_here.x) * sign;
        let dny = (p_n.y - p_here.y) * sign;
        let n_len = (dnx * dnx + dny * dny).sqrt();
        if n_len < 1e-9 {
            simple_local_axes(observer_lon_deg)
        } else {
            let nx = dnx / n_len;
            let ny = dny / n_len;
            (-nx, -ny, ny, -nx)
        }
    } else {
        simple_local_axes(observer_lon_deg)
    };

    let rot = Transform3 {
        r: [[ax, bx, 0.0], [ay, by, 0.0], [0.0, 0.0, 1.0]],
        t: Vec3::ZERO,
    };
    Transform3::moving(observer_coord.x, observer_coord.y, observer_coord.z, Some(rot))
}

fn simple_local_axes(observer_lon_deg: f64) -> (f64, f64, f64, f64) {
    let lr = to_rad(observer_lon_deg);
    let cl = lr.cos();
    let sl = lr.sin();
    (cl, sl, -sl, cl)
}

pub fn comp_trans_mat_vault_to_fe(sky_rot_angle_deg: f64) -> Transform3 {
    Transform3::rotating_z(-to_rad(sky_rot_angle_deg), None)
}

pub fn celest_coord_to_local_globe_coord(
    celest_coord: Vec3,
    trans_mat_celest_to_globe: Transform3,
) -> Vec3 {
    trans_mat_celest_to_globe.trans(celest_coord)
}

pub fn lat_long_to_coord(lat_deg: f64, lon_deg: f64, length: f64) -> Vec3 {
    Vec3::from_angle(lon_deg, lat_deg, length)
}

pub fn coord_to_lat_long(coord: Vec3) -> LatLong {
    let vect_xy = Vec3::new(coord.x, coord.y, 0.0);
    let xy_len = vect_xy.length();
    if xy_len == 0.0 {
        return LatLong {
            lat: if coord.z >= 0.0 { 90.0 } else { -90.0 },
            lng: 0.0,
        };
    }
    let xy_norm = vect_xy.norm();
    let norm = coord.norm();
    let lat = 90.0 - to_deg(limit1(Vec3::new(0.0, 0.0, 1.0).dot(norm)).acos());
    let mut lng = to_deg(limit1(Vec3::new(1.0, 0.0, 0.0).dot(xy_norm)).acos());
    if xy_norm.y < 0.0 {
        lng *= -1.0;
    }
    LatLong { lat, lng }
}

pub fn local_globe_coord_to_angles(coord: Vec3) -> Angles {
    let yz_len = (coord.y * coord.y + coord.z * coord.z).sqrt();
    let norm = coord.norm();
    let azimuth = if yz_len == 0.0 {
        0.0
    } else {
        let yz_norm = Vec3::new(0.0, coord.y / yz_len, coord.z / yz_len);
        let mut az = to_deg(limit1(Vec3::new(0.0, 0.0, 1.0).dot(yz_norm)).acos());
        if yz_norm.y < 0.0 {
            az = 360.0 - az;
        }
        az
    };
    let elevation = 90.0 - to_deg(limit1(Vec3::new(1.0, 0.0, 0.0).dot(norm)).acos());
    Angles { azimuth, elevation }
}

pub fn local_globe_coord_to_local_fe_coord(v: Vec3) -> Vec3 {
    Vec3::new(-v.z, v.y, v.x)
}

pub fn local_globe_coord_to_global_fe_coord(
    v: Vec3,
    trans_mat_local_fe_to_global_fe: Transform3,
) -> Vec3 {
    trans_mat_local_fe_to_global_fe.trans(local_globe_coord_to_local_fe_coord(v))
}

pub fn vault_coord_to_global_fe_coord(v: Vec3, trans_mat_vault_to_fe: Transform3) -> Vec3 {
    trans_mat_vault_to_fe.trans(v)
}

pub fn fe_conceptual_local_globe_unit(
    vault_global_fe: Vec3,
    observer_global_fe: Vec3,
    trans_mat_local_fe_to_global_fe: Transform3,
) -> Vec3 {
    let d = vault_global_fe.sub(observer_global_fe);
    let r = trans_mat_local_fe_to_global_fe.r;
    let lf_x = r[0][0] * d.x + r[1][0] * d.y + r[2][0] * d.z;
    let lf_y = r[0][1] * d.x + r[1][1] * d.y + r[2][1] * d.z;
    let lf_z = r[0][2] * d.x + r[1][2] * d.y + r[2][2] * d.z;
    let local_globe = Vec3::new(lf_z, lf_y, -lf_x);
    let len = local_globe.length();
    if len < 1e-12 {
        Vec3::ZERO
    } else {
        local_globe.scale(1.0 / len)
    }
}

pub fn ra_dec_to_az_el(
    ra_rad: f64,
    dec_rad: f64,
    lat_deg: f64,
    lon_deg: f64,
    gmst_deg: f64,
) -> Angles {
    if !ra_rad.is_finite() || !dec_rad.is_finite() {
        return Angles {
            azimuth: f64::NAN,
            elevation: f64::NAN,
        };
    }
    let lat = to_rad(lat_deg);
    let lst = to_rad(gmst_deg + lon_deg);
    let ha = lst - ra_rad;
    let sin_alt = lat.sin() * dec_rad.sin() + lat.cos() * dec_rad.cos() * ha.cos();
    let alt = limit1(sin_alt).asin();
    let y = -dec_rad.cos() * ha.sin();
    let x = dec_rad.sin() * lat.cos() - dec_rad.cos() * lat.sin() * ha.cos();
    let mut az = to_deg(y.atan2(x));
    az = ((az % 360.0) + 360.0) % 360.0;
    Angles {
        azimuth: az,
        elevation: to_deg(alt),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn local_globe_angles_follow_axis_convention() {
        let zenith = local_globe_coord_to_angles(Vec3::new(1.0, 0.0, 0.0));
        assert_eq!(zenith.azimuth, 0.0);
        assert!((zenith.elevation - 90.0).abs() < 1e-12);

        let east_horizon = local_globe_coord_to_angles(Vec3::new(0.0, 1.0, 0.0));
        assert!((east_horizon.azimuth - 90.0).abs() < 1e-12);
        assert!(east_horizon.elevation.abs() < 1e-12);
    }
}
