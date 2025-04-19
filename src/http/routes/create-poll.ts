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
    });

    // Notify all users about the new poll, excluding the creator
    const users = await prisma.user.findMany({ select: { id: true } });
    const creator = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    const creatorName = creator?.name || "Unknown User";

    const notifications = await Promise.all(
      users
        .filter(user => user.id !== userId) // Exclude creator
        .map(async (user) => ({
          userId: user.id,
          message: `A new poll "${title || 'Untitled Poll'}" has been created by ${creatorName}`,
        }))
    );

    if (notifications.length > 0) {
      await prisma.notification.createMany({
        data: notifications,
      });
    }

    return reply.status(201).send({ pollId: poll.id });
  });
}