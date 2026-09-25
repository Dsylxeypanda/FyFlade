use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex, OnceLock,
};

#[cfg(target_os = "windows")]
use std::time::Duration;
#[cfg(target_os = "windows")]
use tauri::Emitter;

struct CaptureRuntime {
    stop: Arc<AtomicBool>,
}

static CAPTURE_RUNTIME: OnceLock<Mutex<Option<CaptureRuntime>>> = OnceLock::new();

fn capture_runtime() -> &'static Mutex<Option<CaptureRuntime>> {
    CAPTURE_RUNTIME.get_or_init(|| Mutex::new(None))
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct PartyAudioLevels {
    energy: f32,
    bass: f32,
}

#[cfg(target_os = "windows")]
unsafe fn sample_value(pointer: *const u8, bits: u16, float_format: bool) -> f32 {
    if float_format && bits == 32 {
        return unsafe { *(pointer as *const f32) };
    }
    match bits {
        16 => unsafe { *(pointer as *const i16) as f32 / i16::MAX as f32 },
        24 => {
            let bytes = unsafe { std::slice::from_raw_parts(pointer, 3) };
            let raw = ((bytes[2] as i32) << 24 | (bytes[1] as i32) << 16 | (bytes[0] as i32) << 8) >> 8;
            raw as f32 / 8_388_607.0
        }
        32 => unsafe { *(pointer as *const i32) as f32 / i32::MAX as f32 },
        _ => 0.0,
    }
}

#[cfg(target_os = "windows")]
unsafe fn run_capture(
    app: tauri::AppHandle,
    stop: Arc<AtomicBool>,
    ready: std::sync::mpsc::SyncSender<Result<(), String>>,
) {
    use windows::core::IUnknown;
    use windows::Win32::Media::Audio::{
        eConsole, eRender, IAudioCaptureClient, IAudioClient, IMMDeviceEnumerator,
        MMDeviceEnumerator, AUDCLNT_BUFFERFLAGS_SILENT, AUDCLNT_SHAREMODE_SHARED,
        AUDCLNT_STREAMFLAGS_LOOPBACK, WAVEFORMATEXTENSIBLE,
    };
    use windows::Win32::Media::Multimedia::{
        KSDATAFORMAT_SUBTYPE_IEEE_FLOAT, WAVE_FORMAT_IEEE_FLOAT,
    };
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CoTaskMemFree, CoUninitialize,
        CLSCTX_ALL, COINIT_MULTITHREADED,
    };

    if let Err(error) = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED).ok() } {
        let _ = ready.send(Err(format!("Windows audio could not initialize: {error}")));
        return;
    }

    let result = (|| -> Result<(), String> {
        let enumerator: IMMDeviceEnumerator = unsafe {
            CoCreateInstance(&MMDeviceEnumerator, None::<&IUnknown>, CLSCTX_ALL)
        }.map_err(|error| format!("Windows playback devices are unavailable: {error}"))?;
        let device = unsafe { enumerator.GetDefaultAudioEndpoint(eRender, eConsole) }
            .map_err(|error| format!("No default Windows playback device was found: {error}"))?;
        let audio_client: IAudioClient = unsafe { device.Activate(CLSCTX_ALL, None) }
            .map_err(|error| format!("Windows loopback could not open the playback device: {error}"))?;
        let format_pointer = unsafe { audio_client.GetMixFormat() }
            .map_err(|error| format!("Windows playback format is unavailable: {error}"))?;
        let format = unsafe { &*format_pointer };
        let channels = format.nChannels.max(1) as usize;
        let bits = format.wBitsPerSample;
        let bytes_per_sample = (bits / 8).max(1) as usize;
        let float_format = if format.wFormatTag as u32 == WAVE_FORMAT_IEEE_FLOAT {
            true
        } else if format.wFormatTag == 0xfffe && format.cbSize as usize >= 22 {
            let extensible = unsafe { &*(format_pointer as *const WAVEFORMATEXTENSIBLE) };
            let sub_format = unsafe { std::ptr::read_unaligned(std::ptr::addr_of!(extensible.SubFormat)) };
            sub_format == KSDATAFORMAT_SUBTYPE_IEEE_FLOAT
        } else {
            false
        };

        let initialize = unsafe {
            audio_client.Initialize(
                AUDCLNT_SHAREMODE_SHARED,
                AUDCLNT_STREAMFLAGS_LOOPBACK,
                1_000_000,
                0,
                format_pointer,
                None,
            )
        };
        unsafe { CoTaskMemFree(Some(format_pointer.cast())) };
        initialize.map_err(|error| format!("Windows loopback could not start: {error}"))?;

        let capture_client: IAudioCaptureClient = unsafe { audio_client.GetService() }
            .map_err(|error| format!("Windows audio capture is unavailable: {error}"))?;
        unsafe { audio_client.Start() }
            .map_err(|error| format!("Windows audio capture could not run: {error}"))?;
        let _ = ready.send(Ok(()));

        let mut low_pass = 0.0_f32;
        let mut smoothed_energy = 0.0_f32;
        let mut smoothed_bass = 0.0_f32;
        while !stop.load(Ordering::Relaxed) {
            let mut energy_sum = 0.0_f32;
            let mut bass_sum = 0.0_f32;
            let mut total_frames = 0_u32;

            loop {
                let packet_frames = unsafe { capture_client.GetNextPacketSize() }
                    .map_err(|error| format!("Windows audio packet failed: {error}"))?;
                if packet_frames == 0 {
                    break;
                }
                let mut data = std::ptr::null_mut();
                let mut frames = 0_u32;
                let mut flags = 0_u32;
                unsafe { capture_client.GetBuffer(&mut data, &mut frames, &mut flags, None, None) }
                    .map_err(|error| format!("Windows audio buffer failed: {error}"))?;

                if flags & AUDCLNT_BUFFERFLAGS_SILENT.0 as u32 == 0 && !data.is_null() {
                    for frame_index in 0..frames as usize {
                        let mut mono = 0.0_f32;
                        for channel in 0..channels {
                            let offset = (frame_index * channels + channel) * bytes_per_sample;
                            mono += unsafe { sample_value(data.add(offset), bits, float_format) };
                        }
                        mono /= channels as f32;
                        low_pass += 0.035 * (mono - low_pass);
                        energy_sum += mono * mono;
                        bass_sum += low_pass * low_pass;
                    }
                    total_frames += frames;
                }
                unsafe { capture_client.ReleaseBuffer(frames) }
                    .map_err(|error| format!("Windows audio buffer release failed: {error}"))?;
            }

            let (energy, bass) = if total_frames > 0 {
                (
                    ((energy_sum / total_frames as f32).sqrt() * 4.2).clamp(0.0, 1.0),
                    ((bass_sum / total_frames as f32).sqrt() * 8.0).clamp(0.0, 1.0),
                )
            } else {
                (0.0, 0.0)
            };
            smoothed_energy = if energy > smoothed_energy { energy } else { smoothed_energy * 0.82 };
            smoothed_bass = if bass > smoothed_bass { bass } else { smoothed_bass * 0.78 };
            let _ = app.emit("fyflate://party-audio-levels", PartyAudioLevels {
                energy: smoothed_energy,
                bass: smoothed_bass,
            });
            std::thread::sleep(Duration::from_millis(16));
        }
        let _ = unsafe { audio_client.Stop() };
        Ok(())
    })();

    if let Err(error) = result {
        let _ = app.emit("fyflate://party-audio-error", error.clone());
        let _ = ready.send(Err(error));
    }
    unsafe { CoUninitialize() };
}

#[tauri::command]
pub fn start_party_audio_capture(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
        return Err("System-audio rave mode is currently available on Windows only.".into());
    }

    #[cfg(target_os = "windows")]
    {
        let mut runtime = capture_runtime().lock().map_err(|_| "Audio capture state is unavailable.".to_string())?;
        if runtime.as_ref().is_some_and(|active| !active.stop.load(Ordering::Relaxed)) {
            return Ok(());
        }

        let stop = Arc::new(AtomicBool::new(false));
        let thread_stop = stop.clone();
        let (ready_tx, ready_rx) = std::sync::mpsc::sync_channel(1);
        std::thread::Builder::new()
            .name("fyflate-party-audio".into())
            .spawn(move || unsafe { run_capture(app, thread_stop, ready_tx) })
            .map_err(|error| format!("Could not start the Windows audio thread: {error}"))?;

        match ready_rx.recv_timeout(Duration::from_secs(4)) {
            Ok(Ok(())) => {
                *runtime = Some(CaptureRuntime { stop });
                Ok(())
            }
            Ok(Err(error)) => Err(error),
            Err(_) => Err("Windows audio capture did not respond in time.".into()),
        }
    }
}

#[tauri::command]
pub fn stop_party_audio_capture() -> Result<(), String> {
    let mut runtime = capture_runtime().lock().map_err(|_| "Audio capture state is unavailable.".to_string())?;
    if let Some(active) = runtime.take() {
        active.stop.store(true, Ordering::Relaxed);
    }
    Ok(())
}
