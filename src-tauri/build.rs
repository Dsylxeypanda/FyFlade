fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Keep the normal Tauri build step.
    tauri_build::build();

    // Bundle protoc with the project so Windows users do not have to
    // install Protocol Buffers manually.
    let protoc = protoc_bin_vendored::protoc_bin_path()?;
    unsafe { std::env::set_var("PROTOC", protoc); }

    tonic_prost_build::configure()
        .build_server(false)
        .build_client(true)
        .compile_protos(
            &["proto/youtube_live_chat.proto"],
            &["proto"],
        )?;

    println!("cargo:rerun-if-changed=proto/youtube_live_chat.proto");
    println!("cargo:rerun-if-changed=icons/icon.ico");

    Ok(())
}
