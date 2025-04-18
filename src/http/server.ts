import cookie from "@fastify/cookie";
import websocket from "@fastify/websocket";
import fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "../config/index.schema";
import { createPoll } from "./routes/create-poll";
import { getAllPolls } from "./routes/get-poll";
import { getSinglePoll } from "./routes/get-single-poll"; // Add this import
import { voteOnPoll } from "./routes/vote-on-poll";
import { pollResults } from "./websocket/poll-results";
import { authRoutes } from "./routes/auth";

const { PORT, COOKIE_SECRET } = config;
const app = fastify();

app.register(cors, {
  origin: true, // or specify "http://localhost:3000"
  credentials: true
});

app.register(cookie, {
  secret: COOKIE_SECRET,
  hook: "onRequest",
});

app.register(websocket);
app.register(authRoutes);
app.register(createPoll);
app.register(getAllPolls);
app.register(getSinglePoll); // Register the new route
app.register(voteOnPoll);
app.register(pollResults);

app.listen({ port: PORT, host: '0.0.0.0' })
  .then(() => {
    console.log(`HTTP server running on port ${PORT}!`);
  })
  .catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });