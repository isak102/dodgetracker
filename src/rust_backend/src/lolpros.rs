use anyhow::Result;
use serde::Deserialize;
use urlencoding::encode;

#[derive(Deserialize, Debug)]
struct Profile {
    slug: String,
}

async fn get_lolpros_slug(game_name: &str, tag_line: &str) -> Result<Option<String>> {
    let query = encode(format!("{}#{}", game_name, tag_line).as_str()).to_string();
    let url = format!("https://api.lolpros.gg/es/search?query={}", query);

    let profiles: Vec<Profile> = reqwest::get(&url).await?.json().await?;

    if profiles.is_empty() {
        Ok(None)
    } else {
        Ok(Some(profiles[0].slug.clone()))
    }
}
