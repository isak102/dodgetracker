use std::env;

use dotenv::from_path;
use lazy_static::lazy_static;
use riven::RiotApi;

lazy_static! {
    pub static ref RIOT_API: RiotApi = {
        from_path("../../.env").ok();
        RiotApi::new(env::var("RIOT_API_KEY").expect("RIOT API KEY not set"))
    };
}
