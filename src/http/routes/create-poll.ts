import { FastifyInstance } from "fastify";
import { array, object, string } from "zod";
import { prisma } from "../../lib/prisma";
import { authenticate } from "../middleware/auth";

export async function createPoll(app: FastifyInstance) {
  app.post("/polls", { preHandler: authenticate }, async (request, reply) => {
    const createPollBody = object({ title: string().trim(), options: array(string().trim()) });
    const { title, options } = createPollBody.parse(request.body);
    const userId = (request as any).userId;

    const poll = await prisma.poll.create({
      data: {
        title,
        userId,
        options: { createMany: { data: options.map((option) => ({ title: option })) } },
      },
      include: {
        options: true,
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const users = await prisma.user.findMany({ select: { id: true } });
    const creator = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    const creatorName = creator?.name || "Unknown User";

    const notifications = await Promise.all(
      users
        .filter((user) => user.id !== userId)
        .map(async (user) => ({
          userId: user.id,
          message: `A new poll "${title || "Untitled Poll"}" has been created by ${creatorName}`,
        }))
    );

    if (notifications.length > 0) {
      const createdNotifications = await prisma.notification.createMany({
        data: notifications,
      });

      // Emit notifications to each user
      notifications.forEach((notification) => {
        const notificationData = {
          id: `${notification.userId}-${Date.now()}`, // Temporary ID for Socket.IO
          userId: notification.userId,
          message: notification.message,
          read: false,
          createdAt: new Date(),
        };
        app.io.to(notification.userId).emit("newNotification", notificationData);
      });
    }

    // Emit new poll event
    app.io.emit("newPoll", {
      id: poll.id,
      title: poll.title,
      createdAt: poll.createdAt,
      options: poll.options,
      user: poll.user,
    });

    return reply.status(201).send({ pollId: poll.id });
  });
}