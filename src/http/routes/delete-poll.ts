import { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma";
import { authenticate } from "../middleware/auth";

export async function deletePoll(app: FastifyInstance) {
  app.delete("/polls/:pollId", { preHandler: authenticate }, async (request, reply) => {
    const { pollId } = request.params as { pollId: string };
    const userId = (request as any).userId;

    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      include: { options: { include: { votes: { include: { user: true } } } } },
    });

    if (!poll) {
      return reply.status(404).send({ message: "Poll not found" });
    }

    if (poll.userId !== userId) {
      return reply.status(403).send({ message: "Only the poll owner can delete this poll" });
    }

    // Notify users who voted on this poll (excluding the deleter)
    const voters = poll.options
      .flatMap(option => option.votes)
      .map(vote => vote.user) // This can be null
      .filter((user): user is NonNullable<typeof user> => user !== null && user.id !== undefined) // Filter out null and undefined
      .filter(user => user.id !== userId) // Exclude the deleter
      .map(user => user.id);

    if (voters.length > 0) {
      await prisma.notification.createMany({
        data: voters.map(voterId => ({
          userId: voterId,
          message: `The poll "${poll.title || 'Untitled Poll'}" you voted on has been deleted by its owner`,
        })),
      });
    }

    await prisma.poll.delete({
      where: { id: pollId },
    });

    return reply.status(200).send({ message: "Poll deleted successfully" });
  });
}