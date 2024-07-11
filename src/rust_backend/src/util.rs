use std::time::Duration;

use anyhow::{anyhow, Result};
use futures::Future;

pub async fn with_timeout<F, T>(timeout: Duration, future: F) -> Result<T>
where
    F: Future<Output = T> + Send + 'static,
    T: Send + 'static,
{
    match tokio::time::timeout(timeout, future).await {
        Ok(result) => Ok(result),
        Err(_) => Err(anyhow!("Future timed out after {:?}", timeout)),
    }
}
