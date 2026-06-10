use std::env;
use std::process;
use std::str::FromStr;

use conceptual_flat_earth_model::model::{FeModel, FeState, WorldModel};
use conceptual_flat_earth_model::projections::ProjectionId;
use conceptual_flat_earth_model::time::parse_model_datetime;
use conceptual_flat_earth_model::{BodySnapshot, ComputedState};

fn main() {
    let mut state = FeState::default();
    let mut json = false;

    let mut args = env::args().skip(1);
    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--help" | "-h" => {
                print_usage();
                return;
            }
            "--json" => json = true,
            "--lat" => state.observer_lat = parse_value(&arg, args.next()),
            "--lon" | "--long" => state.observer_long = parse_value(&arg, args.next()),
            "--heading" => state.observer_heading = parse_value(&arg, args.next()),
            "--date-time" | "--datetime" => {
                let raw = args.next().unwrap_or_else(|| missing_value(&arg));
                state.date_time = parse_model_datetime(&raw).unwrap_or_else(|| {
                    eprintln!("invalid --date-time value: {raw}");
                    process::exit(2);
                });
            }
            "--projection" => {
                let raw = args.next().unwrap_or_else(|| missing_value(&arg));
                state.map_projection = ProjectionId::from_str(&raw).unwrap_or_else(|_| {
                    eprintln!("invalid --projection value: {raw}");
                    process::exit(2);
                });
            }
            "--world" => {
                let raw = args.next().unwrap_or_else(|| missing_value(&arg));
                state.world_model = WorldModel::from_str(&raw).unwrap_or_else(|_| {
                    eprintln!("invalid --world value: {raw}");
                    process::exit(2);
                });
            }
            "--inside-vault" => state.inside_vault = true,
            _ => {
                eprintln!("unknown argument: {arg}");
                print_usage();
                process::exit(2);
            }
        }
    }

    let computed = FeModel::with_state(state.clone()).compute();
    if json {
        print_json(&state, &computed);
    } else {
        print_human(&state, &computed);
    }
}

fn parse_value<T>(flag: &str, value: Option<String>) -> T
where
    T: FromStr,
{
    let raw = value.unwrap_or_else(|| missing_value(flag));
    raw.parse::<T>().unwrap_or_else(|_| {
        eprintln!("invalid {flag} value: {raw}");
        process::exit(2);
    })
}

fn missing_value(flag: &str) -> String {
    eprintln!("missing value for {flag}");
    process::exit(2);
}

fn print_usage() {
    println!(
        "Usage: fe-model [--date-time DAYS|YYYY-MM-DDTHH:MM:SSZ] [--lat DEG] [--lon DEG] [--projection ID] [--world fe|ge|dp] [--inside-vault] [--json]"
    );
}

fn print_human(state: &FeState, computed: &ComputedState) {
    println!("FE model Rust core");
    println!("date_time: {:.6} days since 2017-01-01 UTC", state.date_time);
    println!(
        "observer: lat {:.4}, lon {:.4}, world {}, projection {}",
        state.observer_lat,
        state.observer_long,
        state.world_model.as_str(),
        state.map_projection.as_str()
    );
    println!("sky_rot_angle: {:.6} deg", computed.sky_rot_angle);
    println!(
        "observer_fe_coord: [{:.6}, {:.6}, {:.6}]",
        computed.observer_fe_coord.x, computed.observer_fe_coord.y, computed.observer_fe_coord.z
    );
    print_body(&computed.sun);
    print_body(&computed.moon);
    println!(
        "moon_phase_fraction: {:.6}  night_factor: {:.6}",
        computed.moon_phase_fraction, computed.night_factor
    );
}

fn print_body(body: &BodySnapshot) {
    println!(
        "{}: az {:.3} deg, el {:.3} deg, gp lat {:.3}, gp lon {:.3}, vault [{:.6}, {:.6}, {:.6}]",
        body.name,
        body.angles_globe.azimuth,
        body.angles_globe.elevation,
        body.ground_point.lat,
        body.ground_point.lng,
        body.vault_coord.x,
        body.vault_coord.y,
        body.vault_coord.z,
    );
}

fn print_json(state: &FeState, computed: &ComputedState) {
    println!("{{");
    println!("  \"date_time\": {:.9},", state.date_time);
    println!("  \"world_model\": \"{}\",", state.world_model.as_str());
    println!("  \"projection\": \"{}\",", state.map_projection.as_str());
    println!("  \"sky_rot_angle\": {:.9},", computed.sky_rot_angle);
    println!(
        "  \"observer_fe_coord\": [{:.9}, {:.9}, {:.9}],",
        computed.observer_fe_coord.x, computed.observer_fe_coord.y, computed.observer_fe_coord.z
    );
    print_body_json("sun", &computed.sun, true);
    print_body_json("moon", &computed.moon, true);
    println!("  \"moon_phase\": {:.9},", computed.moon_phase);
    println!("  \"moon_phase_fraction\": {:.9},", computed.moon_phase_fraction);
    println!("  \"night_factor\": {:.9}", computed.night_factor);
    println!("}}");
}

fn print_body_json(key: &str, body: &BodySnapshot, trailing_comma: bool) {
    println!("  \"{key}\": {{");
    println!("    \"ra_rad\": {:.9},", body.ra_rad);
    println!("    \"dec_rad\": {:.9},", body.dec_rad);
    println!(
        "    \"azimuth\": {:.9}, \"elevation\": {:.9},",
        body.angles_globe.azimuth, body.angles_globe.elevation
    );
    println!(
        "    \"ground_point\": {{ \"lat\": {:.9}, \"lon\": {:.9} }},",
        body.ground_point.lat, body.ground_point.lng
    );
    println!(
        "    \"vault_coord\": [{:.9}, {:.9}, {:.9}],",
        body.vault_coord.x, body.vault_coord.y, body.vault_coord.z
    );
    println!(
        "    \"optical_vault_coord\": [{:.9}, {:.9}, {:.9}]",
        body.optical_vault_coord.x, body.optical_vault_coord.y, body.optical_vault_coord.z
    );
    println!("  }}{}", if trailing_comma { "," } else { "" });
}
