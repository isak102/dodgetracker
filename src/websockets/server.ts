import "dotenv/config";
import { Client } from "pg";
import WebSocket from "ws";

const pgClient = new Client({
  connectionString: "postgresql://isak102:Holkenlinux@localhost/dodgetracker",
});
pgClient
  .connect()
  .then(() => console.log("Connected to Postgres"))
  .catch(console.error);
pgClient
  .query("LISTEN dodge_insert")
  .then(() => {
    console.log("Listening for dodge_insert events");
  })
  .catch(console.error);
pgClient.on("notification", (notification) => {
  if (notification.channel === "dodge_insert") {
    console.log("Received notification:", notification);
    // const payload = JSON.parse(notification.payload ?? "{}");
    broadcastMessage("dodge_insert");
  }
});

const port = 8080;
const wss = new WebSocket.Server({ port });

function broadcastMessage(message: string) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

wss.on("connection", (ws) => {
  console.log(
    `${new Date().toISOString().slice(0, 19).replace("T", "-")}: Client connected`,
  );
  ws.on("close", () => {
    console.log("Client disconnected");
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });

  // ws.on("message", (message: unknown) => {
  //   console.log(`Received message: ${message}`);
  //   ws.send(`Server received: ${message}`);
  // });
});

console.log(`WebSocket server is listening on ws://localhost:${port}`);
