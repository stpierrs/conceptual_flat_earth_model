use crate::math::{limit1, wrap360, DEG};
use crate::time::date_time_to_julian_day;
use crate::vector::Vec3;

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Equatorial {
    pub ra: f64,
    pub dec: f64,
}

pub fn julian_day(date_time: f64) -> f64 {
    date_time_to_julian_day(date_time)
}

pub fn norm360(x: f64) -> f64 {
    wrap360(x)
}

pub fn mean_obliquity_deg(t: f64) -> f64 {
    23.0 + 26.0 / 60.0 + 21.448 / 3600.0
        - (46.8150 * t + 0.00059 * t * t - 0.001813 * t * t * t) / 3600.0
}

pub fn moon_node_omega_deg(t: f64) -> f64 {
    norm360(125.04452 - 1934.136261 * t + 0.0020708 * t * t + t * t * t / 450000.0)
}

pub fn sun_equatorial(date_time: f64) -> Equatorial {
    let jd = julian_day(date_time);
    let t = (jd - 2_451_545.0) / 36_525.0;

    let l0 = norm360(280.46646 + 36000.76983 * t + 0.0003032 * t * t);
    let m = norm360(357.52911 + 35999.05029 * t - 0.0001537 * t * t);
    let mr = m * DEG;
    let c = (1.914602 - 0.004817 * t - 0.000014 * t * t) * mr.sin()
        + (0.019993 - 0.000101 * t) * (2.0 * mr).sin()
        + 0.000289 * (3.0 * mr).sin();
    let lambda_true = l0 + c;
    let omega_deg = moon_node_omega_deg(t);
    let omega = omega_deg * DEG;
    let lambda = lambda_true - 0.00569 - 0.00478 * omega.sin();
    let eps_deg = mean_obliquity_deg(t) + 0.00256 * omega.cos();
    let lam_r = lambda * DEG;
    let eps_r = eps_deg * DEG;

    Equatorial {
        ra: (eps_r.cos() * lam_r.sin()).atan2(lam_r.cos()),
        dec: (eps_r.sin() * lam_r.sin()).asin(),
    }
}

pub fn moon_equatorial(date_time: f64) -> Equatorial {
    let jd = julian_day(date_time);
    let d = jd - 2_451_545.0;
    let t = d / 36_525.0;

    let l0 = norm360(218.3164477 + 481267.88123421 * t - 0.0015786 * t * t);
    let d_arg = norm360(297.8501921 + 445267.1114034 * t - 0.0018819 * t * t);
    let m = norm360(357.5291092 + 35999.0502909 * t - 0.0001536 * t * t);
    let mp = norm360(134.9633964 + 477198.8675055 * t + 0.0087414 * t * t);
    let f = norm360(93.2720950 + 483202.0175233 * t - 0.0036539 * t * t);

    let dr = d_arg * DEG;
    let mr = m * DEG;
    let mpr = mp * DEG;
    let fr = f * DEG;

    let d_lam = 6.288774 * mpr.sin()
        + -1.274027 * (2.0 * dr - mpr).sin()
        + 0.658314 * (2.0 * dr).sin()
        + 0.213618 * (2.0 * mpr).sin()
        + -0.185116 * mr.sin()
        + -0.114332 * (2.0 * fr).sin()
        + 0.058793 * (2.0 * dr - 2.0 * mpr).sin()
        + 0.057066 * (2.0 * dr - mr - mpr).sin()
        + 0.053322 * (2.0 * dr + mpr).sin()
        + 0.045758 * (2.0 * dr - mr).sin()
        + -0.040923 * (mr - mpr).sin()
        + -0.034720 * dr.sin()
        + -0.030383 * (mr + mpr).sin()
        + 0.015327 * (2.0 * dr - 2.0 * fr).sin()
        + -0.012528 * (mpr + 2.0 * fr).sin()
        + 0.010980 * (mpr - 2.0 * fr).sin()
        + 0.010675 * (4.0 * dr - mpr).sin()
        + 0.010034 * (3.0 * mpr).sin()
        + 0.008548 * (4.0 * dr - 2.0 * mpr).sin()
        + -0.007888 * (2.0 * dr + mr - mpr).sin()
        + -0.006766 * (2.0 * dr + mr).sin()
        + -0.005163 * (dr - mpr).sin()
        + 0.004987 * (dr + mr).sin()
        + 0.004036 * (2.0 * dr - mr + mpr).sin()
        + 0.003994 * (2.0 * dr + 2.0 * mpr).sin()
        + 0.003861 * (4.0 * dr).sin()
        + 0.003665 * (2.0 * dr - 3.0 * mpr).sin();

    let beta = 5.128122 * fr.sin()
        + 0.280602 * (mpr + fr).sin()
        + 0.277693 * (mpr - fr).sin()
        + 0.173237 * (2.0 * dr - fr).sin()
        + 0.055413 * (2.0 * dr - mpr + fr).sin()
        + 0.046271 * (2.0 * dr - mpr - fr).sin()
        + 0.032573 * (2.0 * dr + fr).sin()
        + 0.017198 * (2.0 * mpr + fr).sin()
        + 0.009266 * (2.0 * dr + mpr - fr).sin()
        + 0.008822 * (2.0 * mpr - fr).sin()
        + 0.008216 * (2.0 * dr - mr - fr).sin()
        + 0.004324 * (2.0 * dr - 2.0 * mpr - fr).sin()
        + 0.004200 * (2.0 * dr + mpr + fr).sin()
        + -0.003359 * (2.0 * dr + mr - fr).sin()
        + 0.002463 * (2.0 * dr - mr - mpr + fr).sin()
        + 0.002211 * (2.0 * dr - mr + fr).sin()
        + 0.002065 * (2.0 * dr - mr - mpr - fr).sin()
        + -0.001870 * (mr - mpr - fr).sin();

    let omega_deg = moon_node_omega_deg(t);
    let omega = omega_deg * DEG;
    let lambda = norm360(l0 + d_lam) - 0.00478 * omega.sin();
    let eps_deg = mean_obliquity_deg(t) + 0.00256 * omega.cos();

    let lam_r = lambda * DEG;
    let bet_r = beta * DEG;
    let eps_r = eps_deg * DEG;
    Equatorial {
        ra: (lam_r.sin() * eps_r.cos() - bet_r.tan() * eps_r.sin()).atan2(lam_r.cos()),
        dec: (bet_r.sin() * eps_r.cos() + bet_r.cos() * eps_r.sin() * lam_r.sin()).asin(),
    }
}

pub fn greenwich_sidereal_deg(date_time: f64) -> f64 {
    let jd = julian_day(date_time);
    let t = (jd - 2_451_545.0) / 36_525.0;
    let gst = 280.46061837
        + 360.98564736629 * (jd - 2_451_545.0)
        + 0.000387933 * t * t
        - (t * t * t) / 38_710_000.0;
    norm360(gst)
}

pub fn equatorial_to_celest_coord(eq: Equatorial) -> Vec3 {
    let cd = eq.dec.cos();
    Vec3::new(cd * eq.ra.cos(), cd * eq.ra.sin(), eq.dec.sin())
}

pub fn separation_angle(a: Vec3, b: Vec3) -> f64 {
    limit1(a.dot(b)).acos()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::time::{parts_to_model_datetime, DateTimeParts};

    #[test]
    fn greenwich_sidereal_matches_js_sample() {
        let dt = parts_to_model_datetime(DateTimeParts {
            year: 2024,
            month: 1,
            day: 1,
            hour: 0,
            minute: 0,
            second: 0.0,
        });
        assert!((greenwich_sidereal_deg(dt) - 100.152629927).abs() < 1e-9);
    }

    #[test]
    fn sun_and_moon_match_js_sample() {
        let dt = parts_to_model_datetime(DateTimeParts {
            year: 2024,
            month: 1,
            day: 1,
            hour: 0,
            minute: 0,
            second: 0.0,
        });
        let sun = sun_equatorial(dt);
        let moon = moon_equatorial(dt);
        assert!((sun.ra - -1.3801280703616605).abs() < 1e-12);
        assert!((sun.dec - -0.402447564670913).abs() < 1e-12);
        assert!((moon.ra - 2.8148725245010433).abs() < 1e-12);
        assert!((moon.dec - 0.20554036558128436).abs() < 1e-12);
    }

    #[test]
    fn equatorial_vectors_are_unit_length() {
        let sun = equatorial_to_celest_coord(sun_equatorial(0.0));
        let moon = equatorial_to_celest_coord(moon_equatorial(0.0));
        assert!((sun.length() - 1.0).abs() < 1e-12);
        assert!((moon.length() - 1.0).abs() < 1e-12);
    }
}
