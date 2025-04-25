// notification.ts
import { FastifyInstance } from "fastify";
import { authenticate } from "../middleware/auth";
import { prisma } from "../../lib/prisma";

export async function notificationRoutes(app: FastifyInstance) {
  app.get("/notifications", { preHandler: authenticate }, async (request, reply) => {
    const userId = (request as any).userId;
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return reply.send({ notifications });
  });

  app.put("/notifications/:id/read", { preHandler: authenticate }, async (request, reply) => {
    const userId = (request as any).userId;
    const { id } = request.params as { id: string };
    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.userId !== userId) {
      return reply.status(404).send({ message: "Notification not found" });
    }
    await prisma.notification.update({ where: { id }, data: { read: true } });
    return reply.status(200).send({ message: "Marked as read" });
  });

  // New route or function to emit notifications
  app.post("/notifications/emit", { preHandler: authenticate }, async (request, reply) => {
    const { userId, message } = request.body as { userId: string; message: string };
    const notification = await prisma.notification.create({
      data: { userId, message },
    });
    // Emit to the specific user
    app.io.to(userId).emit("newNotification", notification);
    return reply.status(201).send({ notification });
  });
}