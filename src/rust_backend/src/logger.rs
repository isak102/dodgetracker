use std::io::Write;

use flexi_logger::{Cleanup, Criterion, DeferredNow, Logger, LoggerHandle, Naming, WriteMode};
use log::Record;

fn custom_format(w: &mut dyn Write, now: &mut DeferredNow, record: &Record) -> std::io::Result<()> {
    write!(
        w,
        "{} [{}] {}",
        record.level(),
        now.now().format("%Y-%m-%d %H:%M:%S%.3f"),
        &record.args()
    )
}

pub fn init() -> LoggerHandle {
    Logger::try_with_str("info")
        .unwrap()
        .log_to_file(
            flexi_logger::FileSpec::default()
                .directory(".log/")
                .suppress_timestamp()
                .suffix("log"),
        )
        .rotate(
            Criterion::Size(10 * 1024 * 1024),
            Naming::Timestamps,
            Cleanup::KeepLogFiles(10),
        )
        .format(custom_format)
        .print_message()
        .create_symlink("current_logfile")
        .write_mode(WriteMode::Async)
        .duplicate_to_stderr(flexi_logger::Duplicate::All)
        .start()
        .unwrap()
}
