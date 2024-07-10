use flexi_logger::{Cleanup, Criterion, Logger, LoggerHandle, Naming, WriteMode};

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
            Naming::Numbers,
            Cleanup::KeepLogFiles(7),
        )
        .print_message()
        .create_symlink(".log/CURRENT")
        .write_mode(WriteMode::Async)
        .duplicate_to_stderr(flexi_logger::Duplicate::All)
        .start()
        .unwrap()
}
