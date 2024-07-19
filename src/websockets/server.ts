import "dotenv/config";
import { Client } from "pg";
import WebSocket from "ws";
import { dodgeSchema, type Dodge } from "../lib/types";

const port = 8080;
const wss = new WebSocket.Server({ port });

const pgClient = new Client({
  connectionString: process.env.DATABASE_URL,
});
pgClient.connect().catch(console.error);
pgClient
  .query("LISTEN dodge_insert")
  .then(() => {
    console.log("Listening for dodge_insert events");
  })
  .catch(console.error);

pgClient.on("notification", (notification) => {
  if (notification.channel === "dodge_insert") {
    if (notification.payload) {
      const parseResult = dodgeSchema.safeParse(
        JSON.parse(notification.payload),
      );

      if (!parseResult.success) {
        console.error(parseResult.error);
        return;
      }

      broadcastDodge(parseResult.data);
    }
  }
});

function broadcastDodge(dodge: Dodge) {
  console.log("Broadcasting dodge", dodge);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(
        JSON.stringify(
          dodge,
          (_key, value) =>
            typeof value === "bigint" ? value.toString() : value, // eslint-disable-line
        ),
      );
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
});

console.log(`WebSocket server is listening on ws://localhost:${port}`);
