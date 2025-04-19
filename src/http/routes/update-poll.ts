import { FastifyInstance } from "fastify";
import { array, object, string } from "zod";
import { prisma } from "../../lib/prisma";
import { authenticate } from "../middleware/auth";

export async function updatePoll(app: FastifyInstance) {
  app.put("/polls/:pollId", { preHandler: authenticate }, async (request, reply) => {
    const updatePollBody = object({
      title: string().trim().optional(),
      options: array(string().trim()).optional(),
    });
    const { pollId } = request.params as { pollId: string };
    const userId = (request as any).userId;
    const { title, options } = updatePollBody.parse(request.body);

    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
    });

    if (!poll) {
      return reply.status(404).send({ message: "Poll not found" });
    }

    if (poll.userId !== userId) {
      return reply.status(403).send({ message: "Only the poll owner can update this poll" });
    }

    const updatedPoll = await prisma.poll.update({
      where: { id: pollId },
      data: {
        title: title || poll.title,
        updatedAt: new Date(),
        options: options
          ? {
              deleteMany: {},
              createMany: {
                data: options.map((option) => ({ title: option })),
              },
            }
          : undefined,
      },
      include: { options: true },
    });

    return reply.status(200).send({ pollId: updatedPoll.id });
  });
}