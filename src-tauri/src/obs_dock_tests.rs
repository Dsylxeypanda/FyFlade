use super::*;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};

fn request_once(path: &str) -> String {
    let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
    let address = listener.local_addr().unwrap();
    let server = std::thread::spawn(move || {
        let (stream, peer) = listener.accept().unwrap();
        assert!(peer.ip().is_loopback());
        handle_obs_dock_connection(stream);
    });

    let mut client = TcpStream::connect(address).unwrap();
    write!(
        client,
        "GET {path} HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n"
    )
    .unwrap();
    client.flush().unwrap();

    let mut response = String::new();
    client.read_to_string(&mut response).unwrap();
    server.join().unwrap();
    response
}

#[test]
fn obs_dock_serves_clean_local_ui_and_state() {
    update_obs_dock_state(
        r##"{"enabled":true,"appName":"FyFlade","channel":{"name":"#melkepakken","live":false},"messages":[]}"##
            .to_string(),
    )
    .unwrap();

    let dock = request_once("/obs-dock");
    assert!(dock.starts_with("HTTP/1.1 200 OK"));
    assert!(dock.contains("FyFlade OBS Dock"));
    assert!(dock.contains("fetch(\"/state\""));
    assert!(dock.contains("Content-Security-Policy:"));
    assert!(!dock.contains("Access-Control-Allow-Origin"));

    let state = request_once("/state");
    assert!(state.starts_with("HTTP/1.1 200 OK"));
    assert!(state.contains("application/json"));
    assert!(state.contains("\"appName\":\"FyFlade\""));
    assert!(state.contains("\"name\":\"#melkepakken\""));
}
