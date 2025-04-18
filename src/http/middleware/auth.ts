import { FastifyRequest, FastifyReply } from "fastify";
import { verifyToken } from "../../lib/jwt";

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({ message: "Authentication required" });
  }

  const token = authHeader.split(' ')[1];
  const payload = verifyToken(token);

  if (!payload) {
    return reply.status(401).send({ message: "Invalid or expired token" });
  }

  // Add user ID to request for use in route handlers
  // This might require extending the FastifyRequest type
  (request as any).userId = payload.userId;
}