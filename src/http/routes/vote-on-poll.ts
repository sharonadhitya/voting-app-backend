import { FastifyInstance } from "fastify";
import { object, string } from "zod";
import { prisma } from "../../lib/prisma";
import { redis } from "../../lib/redis";
import { voting } from "../../utils/voting-pub-sub";
import { authenticate } from "../middleware/auth";

export async function voteOnPoll(app: FastifyInstance) {
  app.post("/polls/:pollId/votes", { preHandler: authenticate }, async (request, reply) => {
    const voteOnPollBody = object({ pollOptionId: string().trim().uuid() });
    const voteOnPollParams = object({ pollId: string().trim().uuid() });
    const { pollId } = voteOnPollParams.parse(request.params);
    const { pollOptionId } = voteOnPollBody.parse(request.body);
    const userId = (request as any).userId;

    try {
      const previousVote = await prisma.vote.findUnique({
        where: { userId_pollId: { userId, pollId } },
      });
      if (previousVote) {
        if (previousVote.pollOptionId === pollOptionId) {
          return reply.status(400).send({ message: "You have already voted on this poll!" });
        }
        await prisma.vote.delete({ where: { id: previousVote.id } });
        const previousVotes = await redis.zincrby(pollId, -1, previousVote.pollOptionId);
        voting.publish(pollId, { pollOptionId: previousVote.pollOptionId, votes: Number(previousVotes), userId: previousVote.userId });
      }

      const newVote = await prisma.vote.create({
        data: { userId, pollId, pollOptionId },
        include: { user: { select: { id: true, name: true } } },
      });
      const votes = await redis.zincrby(pollId, 1, pollOptionId);
      voting.publish(pollId, { pollOptionId, votes: Number(votes), userId: newVote.userId, userName: newVote.user?.name || "Anonymous" });

      // Notify the poll creator, but only if it's not the voter
      const poll = await prisma.poll.findUnique({
        where: { id: pollId },
        select: { userId: true, title: true },
      });
      if (poll?.userId && poll.userId !== userId) {
        const voter = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
        const voterName = voter?.name || "Anonymous";
        const pollTitle = poll.title || "Untitled Poll";
        await prisma.notification.create({
          data: {
            userId: poll.userId,
            message: `${voterName} voted on your poll "${pollTitle}"`,
          },
        });
      }

      return reply.status(201).send();
    } catch (error) {
      console.error("Error processing vote:", error);
      return reply.status(500).send({ message: "Failed to process vote" });
    }
  });
}