import "dotenv/config";
import fs from "fs";
import https from "https";
import { Client } from "pg";
import { URL } from "url";
import WebSocket, { WebSocketServer } from "ws";
import { z } from "zod";
import { dodgeSchema, type Dodge } from "../lib/types";

type WebSocketWithRegion = WebSocket & { region: string };

const serverOptions = {
  cert: fs.readFileSync(process.env.CERT_FILE!),
  key: fs.readFileSync(process.env.KEY_FILE!),
};

const port = 8080;

const server = https.createServer(serverOptions);
const wss = new WebSocketServer({ server });

const queryParamSchema = z.object({
  region: z.enum(["EUW1", "EUN1", "NA1", "KR", "OC1"]),
});

const pgClient = new Client({
  connectionString: process.env.DATABASE_URL,
});

function broadcastDodge(dodge: Dodge) {
  console.log("Broadcasting dodge", dodge);
  wss.clients.forEach((client) => {
    const region = (client as WebSocketWithRegion).region;
    if (region !== dodge.riotRegion) return;

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

wss.on("connection", (ws: WebSocketWithRegion, req) => {
  console.log(
    `${new Date().toISOString().slice(0, 19).replace("T", "-")}: Client connected`,
  );

  const queryParams = Object.fromEntries(
    new URL(
      req.url ?? "/",
      `https://${req.headers.host}`,
    ).searchParams.entries(),
  );
  const queryParamResult = queryParamSchema.safeParse(queryParams);

  if (!queryParamResult.success) {
    console.error(queryParamResult.error);
    ws.send(
      JSON.stringify({
        error: "Invalid region",
        details: queryParamResult.error,
      }),
    );
    ws.close();
    return;
  }

  ws.region = queryParamResult.data.region;

  ws.on("close", () => {
    console.log("Client disconnected");
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });
});

server.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
