// src/http/middleware/auth.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { verifyToken } from "../../lib/jwt";

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  console.log("Auth header:", authHeader); // Debug log

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log("Missing or invalid auth header");
    return reply.status(401).send({ message: "Authentication required" });
  }

  const token = authHeader.split(" ")[1];
  const payload = verifyToken(token);
  console.log("Token payload:", payload); // Debug log

  if (!payload) {
    console.log("Invalid or expired token");
    return reply.status(401).send({ message: "Invalid or expired token" });
  }

  (request as any).userId = payload.userId;
}