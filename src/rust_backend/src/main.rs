extern crate dotenv;

use dotenv::from_path;
use futures::executor::block_on;
use sea_orm::{Database, DbErr};
use std::env;

async fn run() -> Result<(), DbErr> {
    from_path("../../.env").ok();

    let db_url = env::var("BACKEND_DATABASE_URL").expect("DB URL not set");
    let _db = Database::connect(db_url).await?;

    Ok(())
}

fn main() {
    if let Err(err) = block_on(run()) {
        panic!("{}", err);
    }
    println!("Hello, world!");
}
