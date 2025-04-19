import cookie from "@fastify/cookie";
import websocket from "@fastify/websocket";
import fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "../config/index.schema";
import { createPoll } from "./routes/create-poll";
import { getAllPolls } from "./routes/get-poll";
import { getSinglePoll } from "./routes/get-single-poll";
import { voteOnPoll } from "./routes/vote-on-poll";
import { pollResults } from "./websocket/poll-results";
import { authRoutes } from "./routes/auth";
import { deletePoll } from "./routes/delete-poll";
import { updatePoll } from "./routes/update-poll";

const { PORT, COOKIE_SECRET } = config;
const app = fastify();
app.register(cors, {
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Explicitly allow these methods
  allowedHeaders: ['Authorization', 'Content-Type'], // Allow necessary headers
});app.register(cookie, { secret: COOKIE_SECRET, hook: "onRequest" });
app.register(websocket);
app.register(authRoutes);
app.register(createPoll);
app.register(getAllPolls);
app.register(getSinglePoll);
app.register(voteOnPoll);
app.register(pollResults);
app.register(deletePoll);
app.register(updatePoll);
app.listen({ port: PORT, host: '0.0.0.0' }).then(() => {
  console.log(`HTTP server running on port ${PORT}!`);
}).catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});