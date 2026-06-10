use crate::constants::{CELESTIAL, JULIAN_DAY_AT_MODEL_ZERO};
use crate::math::to_range;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct DateTimeParts {
    pub year: i32,
    pub month: u32,
    pub day: u32,
    pub hour: u32,
    pub minute: u32,
    pub second: f64,
}

pub fn date_to_sky_rot_angle(date_time: f64) -> f64 {
    let angle_deg =
        360.0 * (date_time - CELESTIAL.sun_angle_offset_days) * 24.0 / CELESTIAL.sidereal_day_hours;
    to_range(angle_deg, 360.0)
}

pub fn date_to_sun_angle_celest(date_time: f64) -> f64 {
    360.0 * (date_time - CELESTIAL.sun_angle_offset_days) / CELESTIAL.sun_period_days
}

pub fn date_to_moon_angle_celest(date_time: f64) -> f64 {
    360.0 * (date_time - CELESTIAL.moon_angle_offset_days) / CELESTIAL.moon_period_days
}

pub fn date_to_moon_precess_angle(date_time: f64) -> f64 {
    360.0 * (date_time - CELESTIAL.moon_precess_offset_days)
        / CELESTIAL.moon_precess_period_days
}

pub fn date_time_to_julian_day(date_time: f64) -> f64 {
    JULIAN_DAY_AT_MODEL_ZERO + date_time
}

pub fn unix_seconds_to_model_datetime(unix_seconds: f64) -> f64 {
    let unix_days = unix_seconds / 86_400.0;
    unix_days - (JULIAN_DAY_AT_MODEL_ZERO - crate::constants::JULIAN_DAY_AT_UNIX_EPOCH)
}

pub fn current_model_datetime() -> f64 {
    let Ok(duration) = SystemTime::now().duration_since(UNIX_EPOCH) else {
        return 0.0;
    };
    unix_seconds_to_model_datetime(duration.as_secs_f64())
}

pub fn parts_to_model_datetime(parts: DateTimeParts) -> f64 {
    let unix_days = days_from_civil(parts.year, parts.month, parts.day) as f64;
    let zero_days = days_from_civil(2017, 1, 1) as f64;
    let seconds = parts.hour as f64 * 3600.0 + parts.minute as f64 * 60.0 + parts.second;
    unix_days - zero_days + seconds / 86_400.0
}

pub fn parse_model_datetime(input: &str) -> Option<f64> {
    if let Ok(value) = input.parse::<f64>() {
        return Some(value);
    }

    let trimmed = input.trim().trim_end_matches('Z');
    let (date_part, time_part) = if let Some((date, time)) = trimmed.split_once('T') {
        (date, Some(time))
    } else if let Some((date, time)) = trimmed.split_once(' ') {
        (date, Some(time))
    } else {
        (trimmed, None)
    };

    let mut date_fields = date_part.split('-');
    let year = date_fields.next()?.parse::<i32>().ok()?;
    let month = date_fields.next()?.parse::<u32>().ok()?;
    let day = date_fields.next()?.parse::<u32>().ok()?;
    if date_fields.next().is_some() || !(1..=12).contains(&month) || !(1..=31).contains(&day) {
        return None;
    }

    let (hour, minute, second) = if let Some(time) = time_part {
        let mut time_fields = time.split(':');
        let hour = time_fields.next()?.parse::<u32>().ok()?;
        let minute = time_fields.next().unwrap_or("0").parse::<u32>().ok()?;
        let second = time_fields.next().unwrap_or("0").parse::<f64>().ok()?;
        if time_fields.next().is_some() || hour > 24 || minute > 59 || !(0.0..60.0).contains(&second)
        {
            return None;
        }
        (hour, minute, second)
    } else {
        (0, 0, 0.0)
    };

    Some(parts_to_model_datetime(DateTimeParts {
        year,
        month,
        day,
        hour,
        minute,
        second,
    }))
}

fn days_from_civil(year: i32, month: u32, day: u32) -> i64 {
    let mut y = year as i64;
    let m = month as i64;
    let d = day as i64;
    y -= (m <= 2) as i64;
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = y - era * 400;
    let mp = m + if m > 2 { -3 } else { 9 };
    let doy = (153 * mp + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn model_epoch_is_zero() {
        let dt = parts_to_model_datetime(DateTimeParts {
            year: 2017,
            month: 1,
            day: 1,
            hour: 0,
            minute: 0,
            second: 0.0,
        });
        assert_eq!(dt, 0.0);
        assert_eq!(date_time_to_julian_day(dt), JULIAN_DAY_AT_MODEL_ZERO);
    }

    #[test]
    fn parses_iso_like_dates() {
        assert_eq!(parse_model_datetime("2017-01-02").unwrap(), 1.0);
        assert_eq!(parse_model_datetime("2017-01-01T12:00:00Z").unwrap(), 0.5);
    }
}
