pub mod rate_limit;

pub use rate_limit::{RateLimiter, RateLimiterConfig};
pub use crate::AppState;

use actix_web::HttpRequest;

pub fn extract_client_ip(req: &HttpRequest) -> String {
    req.connection_info()
        .realip_remote_addr()
        .map(|s| s.to_string())
        .unwrap_or_else(|| "unknown".to_string())
}
