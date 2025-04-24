// server.ts
import cookie from "@fastify/cookie";
import fastify from "fastify";
import cors from "@fastify/cors";
import { Server } from "socket.io";
import { config } from "../config/index.schema";
import { createPoll } from "./routes/create-poll";
import { getAllPolls } from "./routes/get-poll";
import { getSinglePoll } from "./routes/get-single-poll";
import { voteOnPoll } from "./routes/vote-on-poll";
import { authRoutes } from "./routes/auth";
import { deletePoll } from "./routes/delete-poll";
import { updatePoll } from "./routes/update-poll";
import { notificationRoutes } from "./routes/notifications";
import { setupSocket } from "./websocket/poll-results";

const { PORT, COOKIE_SECRET } = config;
const app = fastify({ logger: true });

// Register plugins
app.register(cors, {
  origin: "http://localhost:3000",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
});

app.register(cookie, { secret: COOKIE_SECRET, hook: "onRequest" });

// Create Socket.IO instance and decorate Fastify before starting the server
const io = new Server(app.server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket"],
});

// Decorate Fastify with io
app.decorate("io", io);

// Register routes
app.register(authRoutes);
app.register(createPoll);
app.register(getAllPolls);
app.register(getSinglePoll);
app.register(voteOnPoll);
app.register(deletePoll);
app.register(updatePoll);
app.register(notificationRoutes);

// Setup Socket.IO handlers
setupSocket(io);

// Start server
app.listen({ port: PORT, host: "0.0.0.0" }).then((address) => {
  console.log(`HTTP server running on ${address}`);
}).catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

// Declaration merging for Fastify instance
declare module "fastify" {
  interface FastifyInstance {
    io: Server;
  }
}