//! Rate limiting middleware for protecting against brute-force attacks
//! 
//! This module provides an in-memory rate limiter for development/single-instance
//! deployments. For multi-instance deployments, consider Redis-based rate limiting.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;

use tokio::sync::RwLock;

/// Rate limiter configuration
#[derive(Clone, Debug)]
pub struct RateLimiterConfig {
    /// Maximum requests per window
    pub limit: usize,
    /// Window duration in seconds
    pub window_secs: u64,
}

impl RateLimiterConfig {
    pub fn new(limit: usize, window_secs: u64) -> Self {
        Self { limit, window_secs }
    }
    
    /// Default config: 10 requests per minute
    pub fn default_auth() -> Self {
        Self::new(10, 60)
    }
    
    /// Default config: 100 requests per minute (for general API)
    pub fn default_api() -> Self {
        Self::new(100, 60)
    }
}

/// In-memory rate limiter using token bucket algorithm
#[derive(Clone)]
pub struct RateLimiter {
    config: RateLimiterConfig,
    requests: Arc<RwLock<HashMap<String, (usize, Instant)>>>,
}

impl RateLimiter {
    /// Create a new rate limiter with the given configuration
    pub fn new(config: RateLimiterConfig) -> Self {
        Self {
            config,
            requests: Arc::new(RwLock::new(HashMap::new())),
        }
    }
    
    /// Create a rate limiter for authentication endpoints
    pub fn for_auth() -> Self {
        Self::new(RateLimiterConfig::default_auth())
    }
    
    /// Create a rate limiter for general API endpoints
    pub fn for_api() -> Self {
        Self::new(RateLimiterConfig::default_api())
    }
    
    /// Check if a request from the given key should be allowed
    /// Returns true if allowed, false if rate limit exceeded
    pub async fn check(&self, key: &str) -> bool {
        let mut lock = self.requests.write().await;
        let now = Instant::now();
        
        match lock.get_mut(key) {
            Some((count, start)) => {
                // Check if window has expired
                if now.duration_since(*start).as_secs() > self.config.window_secs {
                    // Reset for new window
                    *count = 1;
                    *start = now;
                    true
                } else if *count >= self.config.limit {
                    // Rate limit exceeded
                    false
                } else {
                    // Increment counter
                    *count += 1;
                    true
                }
            }
            None => {
                // First request from this key
                lock.insert(key.to_string(), (1, now));
                true
            }
        }
    }
    
    /// Get remaining requests for a key
    pub async fn remaining(&self, key: &str) -> usize {
        let lock = self.requests.read().await;
        
        match lock.get(key) {
            Some((count, start)) => {
                let elapsed = start.elapsed().as_secs();
                if elapsed > self.config.window_secs {
                    self.config.limit
                } else {
                    self.config.limit.saturating_sub(*count)
                }
            }
            None => self.config.limit,
        }
    }
    
    /// Clear all rate limit data (useful for testing)
    pub async fn clear(&self) {
        let mut lock = self.requests.write().await;
        lock.clear();
    }
    
    /// Get the time until the rate limit resets for a key (in seconds)
    pub async fn reset_in(&self, key: &str) -> Option<u64> {
        let lock = self.requests.read().await;
        
        match lock.get(key) {
            Some((_, start)) => {
                let elapsed = start.elapsed().as_secs();
                if elapsed >= self.config.window_secs {
                    None
                } else {
                    Some(self.config.window_secs - elapsed)
                }
            }
            None => None,
        }
    }
}

/// Helper to extract client IP from request headers or peer address
pub fn extract_client_ip(req: &actix_web::HttpRequest) -> String {
    // Try X-Forwarded-For header first (for proxies)
    if let Some(forwarded) = req.headers().get("X-Forwarded-For") {
        if let Ok(s) = forwarded.to_str() {
            // Take the first IP in the chain (original client)
            if let Some(ip) = s.split(',').next() {
                return ip.trim().to_string();
            }
        }
    }
    
    // Try X-Real-IP header
    if let Some(real_ip) = req.headers().get("X-Real-IP") {
        if let Ok(s) = real_ip.to_str() {
            return s.trim().to_string();
        }
    }
    
    // Fall back to peer address
    req.peer_addr()
        .map(|addr| addr.ip().to_string())
        .unwrap_or_else(|| "unknown".to_string())
}
