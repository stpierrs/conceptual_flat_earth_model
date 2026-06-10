pub const DEG: f64 = std::f64::consts::PI / 180.0;

pub fn to_rad(deg: f64) -> f64 {
    deg * DEG
}

pub fn to_deg(rad: f64) -> f64 {
    rad / DEG
}

pub fn sqr(x: f64) -> f64 {
    x * x
}

pub fn limit1(x: f64) -> f64 {
    x.clamp(-1.0, 1.0)
}

pub fn limit01(x: f64) -> f64 {
    x.clamp(0.0, 1.0)
}

pub fn clamp(x: f64, lo: f64, hi: f64) -> f64 {
    x.clamp(lo, hi)
}

pub fn to_range(x: f64, max: f64) -> f64 {
    let mut v = x.abs() % max;
    if x < 0.0 {
        v = max - v;
    }
    v
}

pub fn wrap360(x: f64) -> f64 {
    ((x % 360.0) + 360.0) % 360.0
}

pub fn wrap180(x: f64) -> f64 {
    ((x + 180.0) % 360.0 + 360.0) % 360.0 - 180.0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ranges_match_js_helpers() {
        assert_eq!(to_range(725.0, 360.0), 5.0);
        assert_eq!(to_range(-5.0, 360.0), 355.0);
        assert_eq!(wrap180(181.0), -179.0);
        assert_eq!(wrap360(-1.0), 359.0);
    }
}
