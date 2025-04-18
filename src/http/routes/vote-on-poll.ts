// In vote-on-poll.ts
import { FastifyInstance } from "fastify";
import { object, string } from "zod";
import { prisma } from "../../lib/prisma";
import { redis } from "../../lib/redis";
import { voting } from "../../utils/voting-pub-sub";
import { authenticate } from "../middleware/auth"; // Import the authentication middleware

export async function voteOnPoll(app: FastifyInstance) {
  app.post("/polls/:pollId/votes", { preHandler: authenticate }, async (request, reply) => {
    const voteOnPollBody = object({
      pollOptionId: string().trim().uuid(),
    });
    const voteOnPollParams = object({
      pollId: string().trim().uuid(),
    });

    const { pollId } = voteOnPollParams.parse(request.params);
    const { pollOptionId } = voteOnPollBody.parse(request.body);
    
    // Get user ID from authenticated request
    const userId = (request as any).userId;

    try {
      // Check for previous vote by this user
      const previousVote = await prisma.vote.findUnique({
        where: {
          userId_pollId: {
            userId,
            pollId,
          },
        },
      });

      // Handle previous vote if it exists
      if (previousVote) {
        if (previousVote.pollOptionId === pollOptionId) {
          return reply
            .status(400)
            .send({ message: "You have already voted on this poll!" });
        }
        
        // Delete previous vote
        await prisma.vote.delete({
          where: {
            id: previousVote.id,
          },
        });
        
        // Decrease score for previous option
        const previousVotes = await redis.zincrby(
          pollId,
          -1,
          previousVote.pollOptionId
        );
        
        voting.publish(pollId, {
          pollOptionId: previousVote.pollOptionId,
          votes: Number(previousVotes),
          userId: previousVote.userId,
        });
      }

      // Create new vote
      const newVote = await prisma.vote.create({
        data: {
          userId,
          pollId,
          pollOptionId,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
            }
          }
        }
      });

      // Increase score for new option
      const votes = await redis.zincrby(pollId, 1, pollOptionId);
      
      // Publish vote with user info
      voting.publish(pollId, {
        pollOptionId,
        votes: Number(votes),
        userId: newVote.userId,
        userName: newVote.user?.name,
      });

      return reply.status(201).send();
    } catch (error) {
      console.error("Error processing vote:", error);
      return reply.status(500).send({ message: "Failed to process vote" });
    }
  });
}