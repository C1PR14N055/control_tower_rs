use std::net::SocketAddr;
use std::str::FromStr;

use futures::StreamExt;
use tokio::sync::mpsc;

use warp::ws::WebSocket;
use warp::*;

mod read_rtl_stream;

use read_rtl_stream::read_loop::read_loop;

use tiny_tokio_actor::*;

#[derive(Clone, Debug)]
struct ServerEvent();

// Mark the struct as a system event message.
impl SystemEvent for ServerEvent {}

#[tokio::main]
async fn main() {
    let path = std::path::Path::new(".env");
    dotenv::from_path(path).ok();

    unsafe {
        if std::env::var("RUST_LOG").is_err() {
            std::env::set_var("RUST_LOG", "info,tiny_tokio_actor=debug,websocket=debug");
        }
    }
    env_logger::init();

    let addr = std::env::var("HOST_PORT")
        .ok()
        .and_then(|string| SocketAddr::from_str(&string).ok())
        .unwrap_or_else(|| SocketAddr::from_str("127.0.0.1:9000").unwrap());

    // Create the event bus and actor system
    let bus = EventBus::<ServerEvent>::new(1000);
    let system = ActorSystem::new("test", bus);

    // Create the warp WebSocket route
    let ws = warp::path!("echo")
        .and(warp::any().map(move || system.clone()))
        .and(warp::addr::remote())
        .and(warp::ws())
        .map(|system: ActorSystem<ServerEvent>, remote: Option<SocketAddr>, ws: warp::ws::Ws| {
            ws.on_upgrade(move |websocket| start_echo(system, remote, websocket))
        });

    // Route to serve index.html
    let index_route =
        warp::path::end().map(|| warp::reply::html(include_str!("./static/index.html")));

    // Route to serve index.js
    let js_route = warp::path("index.js").map(|| include_str!("./static/index.js"));

    // Route to serve index.css
    let css_route = warp::path("index.css").map(|| {
        warp::reply::with_header(include_str!("./static/index.css"), "Content-Type", "text/css")
    });

    // Combine all routes
    let routes = index_route.or(js_route).or(css_route).or(ws);

    // Spawn a task for stream reading
    // tokio::spawn(async move {
    //     read_loop();
    // });

    // Start the server
    warp::serve(routes).run(addr).await;
}

// Starts a new echo actor on our actor system
async fn start_echo(
    _system: ActorSystem<ServerEvent>,
    _remote: Option<SocketAddr>,
    websocket: WebSocket,
) {
    // Split out the websocket into incoming and outgoing
    let (ws_out, _ws_in) = websocket.split();
    tokio::spawn(async move {
        read_loop(ws_out).await;
    });
}

#[derive(Clone)]
struct EchoActor {
    sender: mpsc::UnboundedSender<warp::ws::Message>,
}

impl EchoActor {
    pub fn new(sender: mpsc::UnboundedSender<warp::ws::Message>) -> Self {
        EchoActor { sender }
    }
}

impl Actor<ServerEvent> for EchoActor {}

#[derive(Clone, Debug)]
struct EchoRequest(warp::ws::Message);

impl Message for EchoRequest {
    type Response = ();
}

#[async_trait]
impl Handler<ServerEvent, EchoRequest> for EchoActor {
    async fn handle(&mut self, msg: EchoRequest, ctx: &mut ActorContext<ServerEvent>) {
        ::log::debug!(
            "actor {} on system {} received message! {:?}",
            &ctx.path,
            ctx.system.name(),
            &msg
        );
        self.sender.send(msg.0).unwrap()
    }
}
