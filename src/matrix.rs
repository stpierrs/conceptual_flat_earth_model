use crate::vector::Vec3;

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Transform3 {
    pub r: [[f64; 3]; 3],
    pub t: Vec3,
}

impl Transform3 {
    pub const fn unit() -> Self {
        Self {
            r: [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]],
            t: Vec3::ZERO,
        }
    }

    pub fn rotating_x(angle_rad: f64, base: Option<Self>) -> Self {
        let c = angle_rad.cos();
        let s = angle_rad.sin();
        compose_rot([[1.0, 0.0, 0.0], [0.0, c, -s], [0.0, s, c]], base)
    }

    pub fn rotating_y(angle_rad: f64, base: Option<Self>) -> Self {
        let c = angle_rad.cos();
        let s = angle_rad.sin();
        compose_rot([[c, 0.0, s], [0.0, 1.0, 0.0], [-s, 0.0, c]], base)
    }

    pub fn rotating_z(angle_rad: f64, base: Option<Self>) -> Self {
        let c = angle_rad.cos();
        let s = angle_rad.sin();
        compose_rot([[c, -s, 0.0], [s, c, 0.0], [0.0, 0.0, 1.0]], base)
    }

    pub fn moving(x: f64, y: f64, z: f64, rot_mat: Option<Self>) -> Self {
        Self {
            r: rot_mat.map_or(Self::unit().r, |m| m.r),
            t: Vec3::new(x, y, z),
        }
    }

    pub fn trans(self, v: Vec3) -> Vec3 {
        Vec3::new(
            self.r[0][0] * v.x + self.r[0][1] * v.y + self.r[0][2] * v.z + self.t.x,
            self.r[1][0] * v.x + self.r[1][1] * v.y + self.r[1][2] * v.z + self.t.y,
            self.r[2][0] * v.x + self.r[2][1] * v.y + self.r[2][2] * v.z + self.t.z,
        )
    }
}

fn compose_rot(rot: [[f64; 3]; 3], base: Option<Transform3>) -> Transform3 {
    let Some(base) = base else {
        return Transform3 {
            r: rot,
            t: Vec3::ZERO,
        };
    };

    Transform3 {
        r: mul3(rot, base.r),
        t: Vec3::new(
            rot[0][0] * base.t.x + rot[0][1] * base.t.y + rot[0][2] * base.t.z,
            rot[1][0] * base.t.x + rot[1][1] * base.t.y + rot[1][2] * base.t.z,
            rot[2][0] * base.t.x + rot[2][1] * base.t.y + rot[2][2] * base.t.z,
        ),
    }
}

fn mul3(a: [[f64; 3]; 3], b: [[f64; 3]; 3]) -> [[f64; 3]; 3] {
    let mut r = [[0.0; 3]; 3];
    for i in 0..3 {
        for j in 0..3 {
            r[i][j] = a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j];
        }
    }
    r
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn z_rotation_turns_x_to_y() {
        let m = Transform3::rotating_z(std::f64::consts::FRAC_PI_2, None);
        let p = m.trans(Vec3::new(1.0, 0.0, 0.0));
        assert!(p.x.abs() < 1e-12);
        assert!((p.y - 1.0).abs() < 1e-12);
    }
}
