use std::{env, time::Duration};

use dotenv::from_path;
use sea_orm::{ConnectOptions, Database, DatabaseConnection};
use tokio::sync::OnceCell;

static DB: OnceCell<DatabaseConnection> = OnceCell::const_new();

pub async fn get_db() -> &'static DatabaseConnection {
    DB.get_or_init(|| async {
        from_path("../../.env").ok();
        let db_url = env::var("BACKEND_DATABASE_URL").expect("DB URL not set");

        let mut opt = ConnectOptions::new(db_url);
        opt.max_connections(10) // Adjust this number based on your needs
            .min_connections(5)
            .connect_timeout(Duration::from_secs(30))
            .acquire_timeout(Duration::from_secs(30))
            .idle_timeout(Duration::from_secs(600))
            .max_lifetime(Duration::from_secs(1800))
            .sqlx_logging(false); // Enable SQLx logging for debugging if needed

        Database::connect(opt)
            .await
            .expect("Failed to create database connection pool")
    })
    .await
}
