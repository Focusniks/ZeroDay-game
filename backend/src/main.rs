use actix_web::{middleware::Logger, web, App, HttpResponse, HttpServer, Responder};
use dotenvy::dotenv;
use log::info;
use sqlx::migrate::Migrator;
use sqlx::PgPool;
use std::env;
use std::path::Path;
use zeroday_backend::{db, websocket};

#[derive(Clone)]
struct AppState {
    _pool: PgPool,
}

async fn health() -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({ "ok": true }))
}

#[actix_web::main]
async fn main() -> anyhow::Result<()> {
    // Load `backend/.env` even when CWD is repo root (e.g. `cargo run --manifest-path ...`).
    let env_path = Path::new(env!("CARGO_MANIFEST_DIR")).join(".env");
    let _ = dotenvy::from_path(&env_path).ok();
    dotenv().ok();
    env_logger::init();

    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL is required");
    let jwt_secret = env::var("JWT_SECRET").expect("JWT_SECRET is required");
    let ws_host = env::var("WS_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let ws_port: u16 = env::var("WS_PORT")
        .unwrap_or_else(|_| "8080".to_string())
        .parse()
        .expect("WS_PORT must be a number");

    let http_host = env::var("HTTP_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let http_port: u16 = env::var("HTTP_PORT")
        .unwrap_or_else(|_| "8000".to_string())
        .parse()
        .expect("HTTP_PORT must be a number");

    let pool = db::create_pool(&database_url).await?;
    let migrations_dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("migrations");
    let migrator = Migrator::new(migrations_dir).await?;
    migrator.run(&pool).await?;

    info!("DB connected and migrations applied");

    let ws_task = {
        let ws_host = ws_host.clone();
        let ws_pool = pool.clone();
        let ws_secret = jwt_secret.clone();
        tokio::spawn(async move { websocket::run_ws_server(&ws_host, ws_port, ws_pool, ws_secret).await })
    };

    let state = web::Data::new(AppState { _pool: pool });

    info!("HTTP server listening on http://{http_host}:{http_port}");

    let server = HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .wrap(Logger::default())
            .route("/health", web::get().to(health))
    })
    .bind((http_host.as_str(), http_port))?
    .run();

    tokio::select! {
        res = server => {
            res?;
        }
        res = ws_task => {
            match res {
                Ok(Ok(())) => {}
                Ok(Err(e)) => return Err(e),
                Err(e) => return Err(anyhow::anyhow!(e)),
            }
        }
        _ = tokio::signal::ctrl_c() => {
            info!("shutdown signal received");
        }
    }

    Ok(())
}

