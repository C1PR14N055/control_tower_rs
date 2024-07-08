// converts hex to binary
fn hex_2_bin(a: &String) -> String {
    println!("[-] Hex: {a}");
    // print hex decoded string
    let dec = a
        .chars()
        .map(|c| {
            // Convert each hex character to its binary representation
            let bin = format!("{:04b}", c.to_digit(16).expect("Invalid hex digit"));
            bin
        })
        .collect::<String>(); //

    println!("[-] Bin: {dec}");
    dec
    // the decoded message
}

pub fn parse(hex_message: &str) -> String {
    let binary_message = hex_2_bin(&hex_message.to_string());
    // Ensure the binary message is 112 bits long
    if binary_message.len() != 112 {
        println!("Invalid ADS-B message length.");
        return "Invalid ADS-B message length.".to_string();
    }

    // Extract the type code (bits 33-37, 5 bits)
    let type_code = u8::from_str_radix(&binary_message[32..37], 2).unwrap_or(0);

    match type_code {
        1..=4 => {
            // Identification
            println!("[-] Type Code: {} (Identification)", type_code);
            let category = u8::from_str_radix(&binary_message[37..40], 2).unwrap_or(0);
            let identification = decode_identification(&binary_message[40..88]);
            println!("[-] Category: {}", category);
            println!("[-] Identification: {}", identification);
            format!("tc={};cat={};id={}", type_code, category, identification)
        }

        5..=8 => {
            // Surface Position
            println!("[-] Type Code: {} (Surface Position)", type_code);
            let (lat, lon) = decode_surface_position(&binary_message);
            println!("[-] Latitude: {}", lat);
            println!("[-] Longitude: {}", lon);
            format!("tc={};lat={};lon={}", type_code, lat, lon)
        }

        9..=18 => {
            // Airborne Position and Altitude
            println!("[-] Type Code: {} (Airborne Position)", type_code);
            let altitude = decode_altitude(&binary_message[40..52]);
            println!("[-] Altitude: {} feet", altitude);
            let (lat, lon) = decode_airborne_position(&binary_message);
            println!("[-] Latitude: {}", lat);
            println!("[-] Longitude: {}", lon);
            format!("tc={};alt={};lat={};lon={}", type_code, altitude, lat, lon)
        }
        19 => {
            // Airborne Velocity
            println!("[-] Type Code: {} (Airborne Velocity)", type_code);
            let velocity = decode_velocity(&binary_message[40..]);
            println!("[-] Velocity: {} knots", velocity);
            format!("tc={};vel={};", type_code, velocity)
        }
        20..=22 => {
            // Reserved for future use
            println!("[-] Type Code: {} (Reserved for future use)", type_code);
            format!("tc={};", type_code)
        }
        23..=27 => {
            // Test messages
            println!("[-] Type Code: {} (Test Message)", type_code);
            format!("tc={};", type_code)
        }
        28..=31 => {
            // Extended Squitter
            println!("[-] Type Code: {} (Extended Squitter)", type_code);
            format!("tc={};", type_code)
        }
        _ => {
            println!("[-] Unknown or unsupported type code: {}", type_code);
            format!("tc={};", type_code)
        }
    }
}

// Helper function to decode identification
fn decode_identification(bits: &str) -> String {
    let chars: Vec<char> = vec![
        'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R',
        'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', ' ', ' ', ' ', ' ', ' ',
    ];

    let mut identification = String::new();
    for i in (0..48).step_by(6) {
        let index = u8::from_str_radix(&bits[i..i + 6], 2).unwrap_or(32) as usize;
        if index < chars.len() {
            identification.push(chars[index]);
        } else {
            identification.push('?'); // Use a placeholder for invalid indices
        }
    }
    identification.trim().to_string()
}

// Simplified helper function to decode surface position
fn decode_surface_position(binary_message: &str) -> (f64, f64) {
    // Extract position information (latitude and longitude are 17 bits each)
    let lat_bits = &binary_message[54..71];
    let lon_bits = &binary_message[71..88];

    // Convert to decimal
    let lat = u32::from_str_radix(lat_bits, 2).unwrap_or(0) as f64;
    let lon = u32::from_str_radix(lon_bits, 2).unwrap_or(0) as f64;

    // Simplified position scaling
    let lat = lat * 180.0 / 131072.0 - 90.0; // Latitude scaling
    let lon = lon * 360.0 / 131072.0 - 180.0; // Longitude scaling

    (lat, lon)
}

// Helper function to decode altitude
fn decode_altitude(bits: &str) -> u32 {
    let altitude_code = u16::from_str_radix(bits, 2).unwrap_or(0);
    // Check for overflow
    altitude_code.checked_mul(25).map(|alt| (alt - 1000) as u32).unwrap_or(0)
}

// Simplified helper function to decode airborne position
fn decode_airborne_position(binary_message: &str) -> (f64, f64) {
    // Extract position information (latitude and longitude are 17 bits each)
    let lat_bits = &binary_message[54..71];
    let lon_bits = &binary_message[71..88];

    // Convert to decimal
    let lat = u32::from_str_radix(lat_bits, 2).unwrap_or(0) as f64;
    let lon = u32::from_str_radix(lon_bits, 2).unwrap_or(0) as f64;

    // Simplified position scaling
    let lat = lat * 180.0 / 131072.0 - 90.0; // Latitude scaling
    let lon = lon * 360.0 / 131072.0 - 180.0; // Longitude scaling

    (lat, lon)
}

// Helper function to decode velocity (simplified example)
fn decode_velocity(bits: &str) -> f64 {
    // Simplified example to decode velocity
    let velocity_bits = &bits[13..23]; // Velocity information bits (simplified)
                                       //
    u32::from_str_radix(velocity_bits, 2).unwrap_or(0) as f64
}

// fn test_message() {
//     let binary_message = String::from("0101110101000101110100000110010010110011101000001101010110010011011010100110011011010101101010010100110011110110");
//     let parsed = parse(&binary_message);
//
//     assert_eq!(parsed, "tc=5;lat=37.0;lon=-122.0");
// }
