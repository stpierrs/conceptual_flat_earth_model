use crate::math::to_rad;

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Vec3 {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

impl Vec3 {
    pub const ZERO: Self = Self::new(0.0, 0.0, 0.0);

    pub const fn new(x: f64, y: f64, z: f64) -> Self {
        Self { x, y, z }
    }

    pub fn add(self, rhs: Self) -> Self {
        Self::new(self.x + rhs.x, self.y + rhs.y, self.z + rhs.z)
    }

    pub fn sub(self, rhs: Self) -> Self {
        Self::new(self.x - rhs.x, self.y - rhs.y, self.z - rhs.z)
    }

    pub fn scale(self, scalar: f64) -> Self {
        Self::new(self.x * scalar, self.y * scalar, self.z * scalar)
    }

    pub fn dot(self, rhs: Self) -> f64 {
        self.x * rhs.x + self.y * rhs.y + self.z * rhs.z
    }

    pub fn cross(self, rhs: Self) -> Self {
        Self::new(
            self.y * rhs.z - self.z * rhs.y,
            self.z * rhs.x - self.x * rhs.z,
            self.x * rhs.y - self.y * rhs.x,
        )
    }

    pub fn length(self) -> f64 {
        self.dot(self).sqrt()
    }

    pub fn norm(self) -> Self {
        let length = self.length();
        if length == 0.0 {
            Self::ZERO
        } else {
            self.scale(1.0 / length)
        }
    }

    pub fn from_angle(long_deg: f64, lat_deg: f64, length: f64) -> Self {
        let lo = to_rad(long_deg);
        let la = to_rad(lat_deg);
        let c = la.cos();
        Self::new(
            length * c * lo.cos(),
            length * c * lo.sin(),
            length * la.sin(),
        )
    }
}

impl From<[f64; 3]> for Vec3 {
    fn from(value: [f64; 3]) -> Self {
        Self::new(value[0], value[1], value[2])
    }
}

impl From<Vec3> for [f64; 3] {
    fn from(value: Vec3) -> Self {
        [value.x, value.y, value.z]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn vector_ops_match_expected_axes() {
        let x = Vec3::new(1.0, 0.0, 0.0);
        let y = Vec3::new(0.0, 1.0, 0.0);
        assert_eq!(x.cross(y), Vec3::new(0.0, 0.0, 1.0));
        assert!((Vec3::from_angle(0.0, 90.0, 2.0).z - 2.0).abs() < 1e-12);
    }
}
