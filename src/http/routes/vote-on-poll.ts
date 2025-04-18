import { randomUUID } from "crypto";
import { FastifyInstance } from "fastify";
import { object, string } from "zod";
import { prisma } from "../../lib/prisma";
import { redis } from "../../lib/redis";
import { voting } from "../../utils/voting-pub-sub";
import { verifyToken } from "../../lib/jwt";

export async function voteOnPoll(app: FastifyInstance) {
  app.post("/polls/:pollId/votes", async (request, reply) => {
    const voteOnPollBody = object({
      pollOptionId: string().trim().uuid(),
    });
    const voteOnPollParams = object({
      pollId: string().trim().uuid(),
    });

    const { pollId } = voteOnPollParams.parse(request.params);
    const { pollOptionId } = voteOnPollBody.parse(request.body);

    // Extract user ID if authenticated
    let userId: string | null = null;
    const authHeader = request.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const payload = verifyToken(token);
      if (payload) {
        userId = payload.userId;
      }
    }

    // Get session ID from cookie (for backward compatibility)
    let { sessionId } = request.cookies;
    if (!sessionId && !userId) {
      sessionId = randomUUID();
      reply.setCookie("sessionId", sessionId, {
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // 30 days
        signed: true,
        httpOnly: true,
      });
    }

    try {
      // Check for previous vote by this user or session
      let previousVote = null;

      if (userId) {
        previousVote = await prisma.vote.findUnique({
          where: {
            userId_pollId: {
              userId,
              pollId,
            },
          },
        });
      } else if (sessionId) {
        previousVote = await prisma.vote.findUnique({
          where: {
            sessionId_pollId: {
              sessionId,
              pollId,
            },
          },
        });
      }

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
          sessionId: userId ? null : sessionId, // Use sessionId only for anonymous votes
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

      // Publish vote with user info if available
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