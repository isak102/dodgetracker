use std::env;

use dotenv::from_path;
use sea_orm::{Database, DatabaseConnection};
use tokio::sync::OnceCell;

static DB: OnceCell<DatabaseConnection> = OnceCell::const_new();

pub async fn get_db() -> &'static DatabaseConnection {
    DB.get_or_init(|| async {
        from_path("../../.env").ok();
        let db_url = env::var("BACKEND_DATABASE_URL").expect("DB URL not set");

        Database::connect(db_url).await.unwrap()
    })
    .await
}
