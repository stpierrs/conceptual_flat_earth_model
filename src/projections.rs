use std::str::FromStr;

use crate::math::{limit1, to_rad, DEG};
use crate::vector::Vec3;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProjectionId {
    Ae,
    Blank,
    AeLineart,
    Hellerick,
    Proportional,
    AeDual,
    Equirect,
    Mercator,
    Mollweide,
    Robinson,
    WinkelTripel,
    Hammer,
    Aitoff,
    Sinusoidal,
    EqualEarth,
    Eckert4,
    Orthographic,
    HqBlank,
    HqEquirectDay,
    HqEquirectNight,
    HqAeDual,
    Dp,
    HqAePolarDay,
    HqAePolarNight,
    HqGleasons,
    HqWorldShaded,
    GeArtLine,
    GeArtBlueprint,
    GeArtTopo,
    GeArtSepia,
    GeArtNeon,
    GeArtTranslucent,
    HqOrtho,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ParseProjectionError;

impl ProjectionId {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Ae => "ae",
            Self::Blank => "blank",
            Self::AeLineart => "ae_lineart",
            Self::Hellerick => "hellerick",
            Self::Proportional => "proportional",
            Self::AeDual => "ae_dual",
            Self::Equirect => "equirect",
            Self::Mercator => "mercator",
            Self::Mollweide => "mollweide",
            Self::Robinson => "robinson",
            Self::WinkelTripel => "winkel_tripel",
            Self::Hammer => "hammer",
            Self::Aitoff => "aitoff",
            Self::Sinusoidal => "sinusoidal",
            Self::EqualEarth => "equal_earth",
            Self::Eckert4 => "eckert4",
            Self::Orthographic => "orthographic",
            Self::HqBlank => "hq_blank",
            Self::HqEquirectDay => "hq_equirect_day",
            Self::HqEquirectNight => "hq_equirect_night",
            Self::HqAeDual => "hq_ae_dual",
            Self::Dp => "dp",
            Self::HqAePolarDay => "hq_ae_polar_day",
            Self::HqAePolarNight => "hq_ae_polar_night",
            Self::HqGleasons => "hq_gleasons",
            Self::HqWorldShaded => "hq_world_shaded",
            Self::GeArtLine => "ge_art_line",
            Self::GeArtBlueprint => "ge_art_blueprint",
            Self::GeArtTopo => "ge_art_topo",
            Self::GeArtSepia => "ge_art_sepia",
            Self::GeArtNeon => "ge_art_neon",
            Self::GeArtTranslucent => "ge_art_translucent",
            Self::HqOrtho => "hq_ortho",
        }
    }

    pub fn name(self) -> &'static str {
        match self {
            Self::Ae => "Default (AE)",
            Self::Blank => "Blank (no features)",
            Self::AeLineart => "AE Line Art (black + white outlines)",
            Self::Hellerick => "Hellerick triaxial boreal projection",
            Self::Proportional => "Proportional AE Map",
            Self::AeDual => "AE Equatorial (dual-pole)",
            Self::Equirect => "Equirectangular",
            Self::Mercator => "Mercator",
            Self::Mollweide => "Mollweide",
            Self::Robinson => "Robinson",
            Self::WinkelTripel => "Winkel Tripel",
            Self::Hammer => "Hammer",
            Self::Aitoff => "Aitoff",
            Self::Sinusoidal => "Sinusoidal",
            Self::EqualEarth => "Equal Earth",
            Self::Eckert4 => "Eckert IV",
            Self::Orthographic => "Orthographic",
            Self::HqBlank => "Blank (black disc)",
            Self::HqEquirectDay => "HQ Equirectangular (day)",
            Self::HqEquirectNight => "HQ Equirectangular (night)",
            Self::HqAeDual => "HQ AE Equatorial (dual-pole)",
            Self::Dp => "DP (Dual Pole)",
            Self::HqAePolarDay => "HQ AE Polar (day)",
            Self::HqAePolarNight => "HQ AE Polar (night)",
            Self::HqGleasons => "HQ Gleason's Map",
            Self::HqWorldShaded => "HQ World Shaded Relief",
            Self::GeArtLine => "GE Art - Line Art",
            Self::GeArtBlueprint => "GE Art - Blueprint",
            Self::GeArtTopo => "GE Art - Topo",
            Self::GeArtSepia => "GE Art - Sepia",
            Self::GeArtNeon => "GE Art - Neon",
            Self::GeArtTranslucent => "GE Art - Translucent",
            Self::HqOrtho => "HQ Orthographic Globe",
        }
    }

    pub fn use_projection_grid(self) -> bool {
        matches!(self, Self::Hellerick | Self::Dp)
    }

    pub fn project(self, lat_deg: f64, lon_deg: f64, fe_radius: f64) -> Vec3 {
        match self {
            Self::Hellerick => project_hellerick_boreal(lat_deg, lon_deg, fe_radius),
            Self::Proportional => polar_from_radial(lat_deg, lon_deg, fe_radius, radial_proportional),
            Self::AeDual | Self::HqAeDual | Self::Dp => {
                project_ae_dual(lat_deg, lon_deg, fe_radius)
            }
            Self::Equirect
            | Self::HqEquirectDay
            | Self::HqEquirectNight
            | Self::HqWorldShaded
            | Self::GeArtLine
            | Self::GeArtBlueprint
            | Self::GeArtTopo
            | Self::GeArtSepia
            | Self::GeArtNeon
            | Self::GeArtTranslucent => project_equirect(lat_deg, lon_deg, fe_radius),
            Self::Mercator => project_mercator(lat_deg, lon_deg, fe_radius),
            Self::Mollweide => project_mollweide(lat_deg, lon_deg, fe_radius),
            Self::Robinson => project_robinson(lat_deg, lon_deg, fe_radius),
            Self::WinkelTripel => project_winkel_tripel(lat_deg, lon_deg, fe_radius),
            Self::Hammer => project_hammer(lat_deg, lon_deg, fe_radius),
            Self::Aitoff => project_aitoff(lat_deg, lon_deg, fe_radius),
            Self::Sinusoidal => project_sinusoidal(lat_deg, lon_deg, fe_radius),
            Self::EqualEarth => project_equal_earth(lat_deg, lon_deg, fe_radius),
            Self::Eckert4 => project_eckert_iv(lat_deg, lon_deg, fe_radius),
            Self::Orthographic | Self::HqOrtho => {
                project_orthographic(lat_deg, lon_deg, fe_radius)
            }
            Self::Ae
            | Self::Blank
            | Self::AeLineart
            | Self::HqBlank
            | Self::HqAePolarDay
            | Self::HqAePolarNight
            | Self::HqGleasons => polar_from_radial(lat_deg, lon_deg, fe_radius, radial_ae),
        }
    }
}

impl Default for ProjectionId {
    fn default() -> Self {
        Self::Ae
    }
}

impl FromStr for ProjectionId {
    type Err = ParseProjectionError;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        let id = match value {
            "ae" => Self::Ae,
            "blank" => Self::Blank,
            "ae_lineart" => Self::AeLineart,
            "hellerick" => Self::Hellerick,
            "proportional" => Self::Proportional,
            "ae_dual" => Self::AeDual,
            "equirect" => Self::Equirect,
            "mercator" => Self::Mercator,
            "mollweide" => Self::Mollweide,
            "robinson" => Self::Robinson,
            "winkel_tripel" => Self::WinkelTripel,
            "hammer" => Self::Hammer,
            "aitoff" => Self::Aitoff,
            "sinusoidal" => Self::Sinusoidal,
            "equal_earth" => Self::EqualEarth,
            "eckert4" => Self::Eckert4,
            "orthographic" => Self::Orthographic,
            "hq_blank" => Self::HqBlank,
            "hq_equirect_day" => Self::HqEquirectDay,
            "hq_equirect_night" => Self::HqEquirectNight,
            "hq_ae_dual" => Self::HqAeDual,
            "dp" => Self::Dp,
            "hq_ae_polar_day" => Self::HqAePolarDay,
            "hq_ae_polar_night" => Self::HqAePolarNight,
            "hq_gleasons" => Self::HqGleasons,
            "hq_world_shaded" => Self::HqWorldShaded,
            "ge_art_line" => Self::GeArtLine,
            "ge_art_blueprint" => Self::GeArtBlueprint,
            "ge_art_topo" => Self::GeArtTopo,
            "ge_art_sepia" => Self::GeArtSepia,
            "ge_art_neon" => Self::GeArtNeon,
            "ge_art_translucent" => Self::GeArtTranslucent,
            "hq_ortho" => Self::HqOrtho,
            _ => return Err(ParseProjectionError),
        };
        Ok(id)
    }
}

pub fn canonical_lat_long_to_disc(
    lat_deg: f64,
    lon_deg: f64,
    fe_radius: f64,
    active_projection: Option<ProjectionId>,
) -> Vec3 {
    if let Some(projection) = active_projection.filter(|p| p.use_projection_grid()) {
        return projection.project(lat_deg, lon_deg, fe_radius);
    }

    polar_from_radial(lat_deg, lon_deg, fe_radius, radial_ae)
}

fn polar_from_radial(
    lat_deg: f64,
    lon_deg: f64,
    fe_radius: f64,
    radial_fn: fn(f64) -> f64,
) -> Vec3 {
    let lo = to_rad(lon_deg);
    let radius = fe_radius * radial_fn(lat_deg);
    Vec3::new(radius * lo.cos(), radius * lo.sin(), 0.0)
}

fn radial_ae(lat_deg: f64) -> f64 {
    (90.0 - lat_deg) / 180.0
}

fn radial_proportional(lat_deg: f64) -> f64 {
    ((90.0 - lat_deg) / 180.0).powf(0.75)
}

#[allow(dead_code)]
fn radial_laea(lat_deg: f64) -> f64 {
    ((90.0 - lat_deg) * std::f64::consts::PI / 360.0).sin()
}

const HELLERICK_MAIN: [f64; 3] = [-70.0 * DEG, 20.0 * DEG, 110.0 * DEG];
const HELLERICK_MID: [f64; 3] = [-25.0 * DEG, 65.0 * DEG, -160.0 * DEG];

fn hellerick_ang_dist(a: f64, b: f64) -> f64 {
    let mut d = a - b;
    if d > std::f64::consts::PI {
        d -= 2.0 * std::f64::consts::PI;
    }
    if d < -std::f64::consts::PI {
        d += 2.0 * std::f64::consts::PI;
    }
    d
}

fn project_hellerick_boreal(lat_deg: f64, lon_deg: f64, fe_radius: f64) -> Vec3 {
    let x_i = lon_deg * DEG;
    let y_i = lat_deg * DEG;
    let radius = std::f64::consts::FRAC_PI_2 - y_i;

    let mut s0 = 0usize;
    for i in 0..3 {
        if hellerick_ang_dist(x_i, HELLERICK_MAIN[i]).abs()
            < hellerick_ang_dist(x_i, HELLERICK_MAIN[s0]).abs()
        {
            s0 = i;
        }
    }
    let xims0 = hellerick_ang_dist(x_i, HELLERICK_MAIN[s0]);

    let mut s1 = 0usize;
    for i in 0..3 {
        let ximi1 = hellerick_ang_dist(x_i, HELLERICK_MID[i]);
        let xims1 = hellerick_ang_dist(x_i, HELLERICK_MID[s1]);
        if ximi1 * xims0 <= 0.0 && ximi1.abs() <= xims1.abs() {
            s1 = i;
        }
    }

    let mut sh = hellerick_ang_dist(x_i, HELLERICK_MAIN[s0])
        / hellerick_ang_dist(HELLERICK_MID[s1], HELLERICK_MAIN[s0]);
    let mut sign = 1.0;
    if sh < 0.0 {
        sign = -1.0;
        sh = -sh;
    }
    if sh > 1.0 {
        sh = 1.0;
    }

    sh = 1.0 - (1.0 - sh).powf(1.0 - radius / std::f64::consts::PI);

    let alpha = sign * sh * hellerick_ang_dist(HELLERICK_MID[s1], HELLERICK_MAIN[s0])
        + HELLERICK_MAIN[s0]
        - HELLERICK_MAIN[1];

    let k = fe_radius / std::f64::consts::PI;
    Vec3::new(k * radius * alpha.sin(), -k * radius * alpha.cos(), 0.0)
}

fn project_ae_dual(lat_deg: f64, lon_deg: f64, fe_radius: f64) -> Vec3 {
    let phi = lat_deg * DEG;
    let lam = lon_deg * DEG;
    let cos_c = phi.cos() * lam.cos();
    let c = limit1(cos_c).acos();
    if c < 1e-9 {
        return Vec3::ZERO;
    }
    let k = (c / std::f64::consts::PI) / c.sin();
    Vec3::new(
        fe_radius * k * phi.cos() * lam.sin(),
        fe_radius * k * phi.sin(),
        0.0,
    )
}

fn project_equirect(lat_deg: f64, lon_deg: f64, fe_radius: f64) -> Vec3 {
    Vec3::new(fe_radius * lon_deg / 180.0, fe_radius * lat_deg / 360.0, 0.0)
}

fn project_mercator(lat_deg: f64, lon_deg: f64, fe_radius: f64) -> Vec3 {
    let phi = lat_deg.clamp(-85.0, 85.0) * DEG;
    let y = (std::f64::consts::FRAC_PI_4 + phi / 2.0).tan().ln();
    Vec3::new(fe_radius * lon_deg / 180.0, fe_radius * y / 3.131, 0.0)
}

fn project_mollweide(lat_deg: f64, lon_deg: f64, fe_radius: f64) -> Vec3 {
    let phi = lat_deg * DEG;
    let lam = lon_deg * DEG;
    let mut theta = phi;
    for _ in 0..10 {
        let num = 2.0 * theta + (2.0 * theta).sin() - std::f64::consts::PI * phi.sin();
        let den = 2.0 + 2.0 * (2.0 * theta).cos();
        let dt = num / if den.abs() < 1e-9 { 1e-9 } else { den };
        theta -= dt;
        if dt.abs() < 1e-8 {
            break;
        }
    }
    let x = (2.0 * 2.0_f64.sqrt() / std::f64::consts::PI) * lam * theta.cos();
    let y = 2.0_f64.sqrt() * theta.sin();
    Vec3::new(
        fe_radius * x / (2.0 * 2.0_f64.sqrt()),
        fe_radius * y / (2.0 * 2.0_f64.sqrt()),
        0.0,
    )
}

const ROBINSON_TABLE: [[f64; 3]; 19] = [
    [0.0, 1.0000, 0.0000],
    [5.0, 0.9986, 0.0620],
    [10.0, 0.9954, 0.1240],
    [15.0, 0.9900, 0.1860],
    [20.0, 0.9822, 0.2480],
    [25.0, 0.9730, 0.3100],
    [30.0, 0.9600, 0.3720],
    [35.0, 0.9427, 0.4340],
    [40.0, 0.9216, 0.4958],
    [45.0, 0.8962, 0.5571],
    [50.0, 0.8679, 0.6176],
    [55.0, 0.8350, 0.6769],
    [60.0, 0.7986, 0.7346],
    [65.0, 0.7597, 0.7903],
    [70.0, 0.7186, 0.8435],
    [75.0, 0.6732, 0.8936],
    [80.0, 0.6213, 0.9394],
    [85.0, 0.5722, 0.9761],
    [90.0, 0.5322, 1.0000],
];

fn robinson_lookup(abs_lat_deg: f64) -> (f64, f64) {
    let i = ((abs_lat_deg / 5.0).floor() as usize).clamp(0, 17);
    let r0 = ROBINSON_TABLE[i];
    let r1 = ROBINSON_TABLE[i + 1];
    let t = (abs_lat_deg - r0[0]) / 5.0;
    (r0[1] + t * (r1[1] - r0[1]), r0[2] + t * (r1[2] - r0[2]))
}

fn project_robinson(lat_deg: f64, lon_deg: f64, fe_radius: f64) -> Vec3 {
    let sign = if lat_deg < 0.0 { -1.0 } else { 1.0 };
    let (a, b) = robinson_lookup(lat_deg.abs());
    let x = 0.8487 * a * lon_deg * DEG;
    let y = 1.3523 * sign * b;
    Vec3::new(
        fe_radius * x / (0.8487 * std::f64::consts::PI),
        fe_radius * y / 2.666,
        0.0,
    )
}

fn project_winkel_tripel(lat_deg: f64, lon_deg: f64, fe_radius: f64) -> Vec3 {
    let phi = lat_deg * DEG;
    let lam = lon_deg * DEG;
    let alpha = (phi.cos() * (lam / 2.0).cos()).min(1.0).acos();
    let sinc = if alpha.abs() < 1e-9 {
        1.0
    } else {
        alpha.sin() / alpha
    };
    let aitoff_x = 2.0 * phi.cos() * (lam / 2.0).sin() / sinc;
    let aitoff_y = phi.sin() / sinc;
    let phi1 = (2.0 / std::f64::consts::PI).acos();
    let eq_x = lam * phi1.cos();
    let eq_y = phi;
    let x = (aitoff_x + eq_x) / 2.0;
    let y = (aitoff_y + eq_y) / 2.0;
    Vec3::new(fe_radius * x / 2.507, fe_radius * y / 2.507, 0.0)
}

fn project_hammer(lat_deg: f64, lon_deg: f64, fe_radius: f64) -> Vec3 {
    let phi = lat_deg * DEG;
    let lam = lon_deg * DEG;
    let d = (1.0 + phi.cos() * (lam / 2.0).cos()).sqrt();
    let x = (2.0 * 2.0_f64.sqrt() * phi.cos() * (lam / 2.0).sin()) / d;
    let y = (2.0_f64.sqrt() * phi.sin()) / d;
    Vec3::new(
        fe_radius * x / (2.0 * 2.0_f64.sqrt()),
        fe_radius * y / (2.0 * 2.0_f64.sqrt()),
        0.0,
    )
}

fn project_aitoff(lat_deg: f64, lon_deg: f64, fe_radius: f64) -> Vec3 {
    let phi = lat_deg * DEG;
    let lam = lon_deg * DEG;
    let alpha = (phi.cos() * (lam / 2.0).cos()).min(1.0).acos();
    let sinc = if alpha.abs() < 1e-9 {
        1.0
    } else {
        alpha.sin() / alpha
    };
    let x = 2.0 * phi.cos() * (lam / 2.0).sin() / sinc;
    let y = phi.sin() / sinc;
    Vec3::new(
        fe_radius * x / std::f64::consts::PI,
        fe_radius * y / std::f64::consts::PI,
        0.0,
    )
}

fn project_sinusoidal(lat_deg: f64, lon_deg: f64, fe_radius: f64) -> Vec3 {
    let phi = lat_deg * DEG;
    let lam = lon_deg * DEG;
    let x = lam * phi.cos();
    let y = phi;
    Vec3::new(
        fe_radius * x / std::f64::consts::PI,
        fe_radius * y / std::f64::consts::PI,
        0.0,
    )
}

fn project_equal_earth(lat_deg: f64, lon_deg: f64, fe_radius: f64) -> Vec3 {
    let a1 = 1.340264;
    let a2 = -0.081106;
    let a3 = 0.000893;
    let a4 = 0.003796;
    let m = 3.0_f64.sqrt() / 2.0;
    let phi = lat_deg * DEG;
    let lam = lon_deg * DEG;
    let th = (m * phi.sin()).asin();
    let th2 = th * th;
    let th6 = th2 * th2 * th2;
    let denom = m * (a1 + 3.0 * a2 * th2 + th6 * (7.0 * a3 + 9.0 * a4 * th2));
    let x = lam * th.cos() / denom;
    let y = th * (a1 + a2 * th2 + th6 * (a3 + a4 * th2));
    Vec3::new(fe_radius * x / 2.7, fe_radius * y / 2.7, 0.0)
}

fn project_orthographic(lat_deg: f64, lon_deg: f64, fe_radius: f64) -> Vec3 {
    let phi = lat_deg * DEG;
    let lam = lon_deg * DEG;
    Vec3::new(fe_radius * phi.cos() * lam.sin(), fe_radius * phi.sin(), 0.0)
}

fn project_eckert_iv(lat_deg: f64, lon_deg: f64, fe_radius: f64) -> Vec3 {
    let phi = lat_deg * DEG;
    let lam = lon_deg * DEG;
    let mut th = phi / 2.0;
    for _ in 0..10 {
        let num = th + th.sin() * th.cos() + 2.0 * th.sin()
            - (2.0 + std::f64::consts::FRAC_PI_2) * phi.sin();
        let den = 1.0 + th.cos() * th.cos() - th.sin() * th.sin() + 2.0 * th.cos();
        let dt = num / if den.abs() < 1e-9 { 1e-9 } else { den };
        th -= dt;
        if dt.abs() < 1e-8 {
            break;
        }
    }
    let kx = 2.0 / (std::f64::consts::PI * (4.0 + std::f64::consts::PI)).sqrt();
    let ky = 2.0 * (std::f64::consts::PI / (4.0 + std::f64::consts::PI)).sqrt();
    let x = kx * lam * (1.0 + th.cos());
    let y = ky * th.sin();
    let scale = kx * std::f64::consts::PI * 2.0;
    Vec3::new(fe_radius * x / scale, fe_radius * y / scale, 0.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ae_projection_matches_js_geometry() {
        assert_eq!(ProjectionId::Ae.project(90.0, 0.0, 1.0), Vec3::ZERO);
        let equator = ProjectionId::Ae.project(0.0, 0.0, 1.0);
        assert!((equator.x - 0.5).abs() < 1e-12);
        assert!(equator.y.abs() < 1e-12);
        let south = ProjectionId::Ae.project(-90.0, 0.0, 1.0);
        assert!((south.length() - 1.0).abs() < 1e-12);
    }

    #[test]
    fn dual_pole_center_is_zero() {
        assert_eq!(ProjectionId::Dp.project(0.0, 0.0, 1.0), Vec3::ZERO);
    }
}
