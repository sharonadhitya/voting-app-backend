import { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma";
import { authenticate } from "../middleware/auth";

export async function deletePoll(app: FastifyInstance) {
  app.delete("/polls/:pollId", { preHandler: authenticate }, async (request, reply) => {
    const { pollId } = request.params as { pollId: string };
    const userId = (request as any).userId;

    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
    });

    if (!poll) {
      return reply.status(404).send({ message: "Poll not found" });
    }

    if (poll.userId !== userId) {
      return reply.status(403).send({ message: "Only the poll owner can delete this poll" });
    }

    await prisma.poll.delete({
      where: { id: pollId },
    });

    return reply.status(200).send({ message: "Poll deleted successfully" });
  });
}