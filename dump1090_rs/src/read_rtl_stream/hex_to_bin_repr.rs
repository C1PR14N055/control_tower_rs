pub fn hex_to_bin_repr(a: &String) -> String {
    // print hex encoded string
    println!("[-] Hex: {a}");
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
}
