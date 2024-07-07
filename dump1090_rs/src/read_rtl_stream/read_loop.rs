use std::net::IpAddr;

use clap::Parser;
use futures::stream::SplitSink;
use futures::SinkExt;
use libdump1090_rs::utils;
use num_complex::Complex;
use soapysdr::Direction;
use warp::filters::ws::{Message, WebSocket};

use crate::read_rtl_stream::parse::parse;
use crate::read_rtl_stream::sdrconfig::{SdrConfig, DEFAULT_CONFIG};

const DIRECTION: Direction = Direction::Rx;

const CUSTOM_CONFIG_HELP: &str =
    "Filepath for config.toml file overriding or adding sdr config values for soapysdr";

const CUSTOM_CONFIG_LONG_HELP: &str = r#"Filepath for config.toml file overriding 
OR adding sdr config values for soapysdr.

An example of overriding the included config of `config.toml` for the rtlsdr:

[[sdr]]
driver = "rtlsdr"

[[sdrs.setting]]
key = "biastee"
value = "true"

[[sdr.gain]]
key = "GAIN"
value = 20.0
"#;

#[derive(Debug, Parser)]
#[clap(
    version,
    name = "ControlTower",
    author = "Ciprian M.",
    about = "ADS-B Demodulator and Radar, ATC Radio"
)]
struct Options {
    /// ip address to bind with for client connections
    #[clap(long, default_value = "127.0.0.1")]
    host: IpAddr,

    /// port to bind with for client connections
    #[clap(long, default_value = "3000")]
    port: u16,

    /// soapysdr driver name (sdr device) from default `config.toml` or `--custom-config`
    ///
    /// This is used both for instructing soapysdr how to find the sdr and what sdr is being used,
    /// as well as the key value in the `config.toml` file. This must match exactly with the
    /// `.driver` field in order for this application to use the provided config settings.
    #[clap(long, default_value = "rtlsdr")]
    driver: String,

    /// specify extra values for soapysdr driver specification
    #[clap(long)]
    driver_extra: Vec<String>,

    #[clap(long, help = CUSTOM_CONFIG_HELP, long_help = CUSTOM_CONFIG_LONG_HELP)]
    custom_config: Option<String>,
}

fn to_binary_repr(a: &String) {
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
    // the decoded message
    parse(&dec);
}

// main will exit as 0 for success, 1 on error
pub async fn read_loop(mut ws_out: SplitSink<WebSocket, Message>) {
    // read in default compiled config
    let mut config: SdrConfig = toml::from_str(DEFAULT_CONFIG).unwrap();

    // parse opts
    let options = Options::parse();

    // parse config from custom filepath
    if let Some(config_filepath) = options.custom_config {
        let custom_config: SdrConfig =
            toml::from_str(&std::fs::read_to_string(&config_filepath).unwrap()).unwrap();
        println!("[-] read in custom config: {config_filepath}");
        // push new configs to the front, so that the `find` method finds these first
        for sdr in custom_config.sdrs {
            config.sdrs.insert(0, sdr);
        }
    }

    // setup soapysdr driver
    let mut driver = String::new();
    driver.push_str(&format!("driver={}", options.driver));

    for e in options.driver_extra {
        driver.push_str(&format!(",{e}"));
    }

    println!("[-] using soapysdr driver_args: {driver}");
    let d = match soapysdr::Device::new(&*driver) {
        Ok(d) => d,
        Err(e) => {
            println!("[!] soapysdr error: {e}");
            return;
        }
    };

    // check if --driver exists in config, with selected driver
    let channel = if let Some(sdr) = config.sdrs.iter().find(|a| a.driver == options.driver) {
        println!("[-] using config: {sdr:#?}");
        // set user defined config settings
        let channel = sdr.channel;

        for gain in &sdr.gain {
            println!("[-] Writing gain: {} = {}", gain.key, gain.value);
            d.set_gain_element(DIRECTION, channel, &*gain.key, gain.value).unwrap();
        }
        if let Some(setting) = &sdr.setting {
            for setting in setting {
                println!("[-] Writing setting: {} = {}", setting.key, setting.value);
                d.write_setting(&*setting.key, &*setting.value).unwrap();
                println!(
                    "[-] Reading setting: {} = {}",
                    setting.key,
                    d.read_setting(&*setting.key).unwrap()
                );
            }
        }

        if let Some(antenna) = &sdr.antenna {
            println!("setting antenna: {}", antenna.name);
            d.set_antenna(DIRECTION, channel, antenna.name.clone()).unwrap();
        }

        // now we set defaults
        d.set_frequency(DIRECTION, channel, 1_090_000_000.0, ()).unwrap();
        println!("[-] frequency: {:?}", d.frequency(DIRECTION, channel));

        d.set_sample_rate(DIRECTION, channel, 2_400_000.0).unwrap();
        println!("[-] sample rate: {:?}", d.sample_rate(DIRECTION, 0));
        channel
    } else {
        panic!("[-] selected --driver gain values not found in custom or default config");
    };

    let mut stream = d.rx_stream::<Complex<i16>>(&[channel]).unwrap();

    let mut buf = vec![Complex::new(0, 0); stream.mtu().unwrap()];
    stream.activate(None).unwrap();

    // TODO: make this a log2 function
    println!("[-] Sent retarded data to client");
    let bin_msg = "0101110101000101110100000110010010110011101000001101010110010011011010100110011011010101101010010100110011110110";
    ws_out.send(Message::text(bin_msg)).await.unwrap();

    loop {
        // try and read from sdr device
        match stream.read(&mut [&mut buf], 5_000_000) {
            Ok(len) => {
                //utils::save_test_data(&buf[..len]);
                // demodulate new data
                let buf = &buf[..len];
                let outbuf = utils::to_mag(buf);
                let resulting_data = libdump1090_rs::demod_2400::demodulate2400(&outbuf).unwrap();

                // send new data to connected clients
                if !resulting_data.is_empty() {
                    let mut res = Vec::new();

                    for a in resulting_data.iter() {
                        let a = hex::encode(a);
                        // do whatever with the hex data
                        to_binary_repr(&a);
                        let a = format!("[-] ADs-B: *{a};");
                        println!("{}", &a[..a.len() - 1]);
                        let _ws_res = ws_out.send(Message::text(&a)).await;
                        res.push(a);
                    }
                }
            }
            Err(e) => {
                // exit on sdr timeout
                let code = e.code;
                if matches!(code, soapysdr::ErrorCode::Timeout) {
                    println!("[!] exiting: could not read SDR device");
                    // exit with error code as 1 so that systemctl can restart
                    std::process::exit(1);
                }
            }
        }
    }
}
