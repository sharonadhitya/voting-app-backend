import { FastifyInstance } from "fastify";
import { object, string } from "zod";
import { prisma } from "../../lib/prisma";

export async function getSinglePoll(app: FastifyInstance) {
  app.get("/polls/:pollId", async (request, reply) => {
    const getPollParams = object({
      pollId: string().trim().uuid(),
    });

    try {
      const { pollId } = getPollParams.parse(request.params);

      const poll = await prisma.poll.findUnique({
        where: {
          id: pollId,
        },
        include: {
          options: {
            select: {
              id: true,
              title: true,
              votes: {
                select: {
                  id: true,
                }
              }
            }
          },
          user: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      if (!poll) {
        return reply.status(404).send({ message: "Poll not found" });
      }

      // Transform data to include vote counts
      const formattedPoll = {
        ...poll,
        options: poll.options.map(option => ({
          id: option.id,
          title: option.title,
          score: option.votes.length
        }))
      };

      return reply.send({ poll: formattedPoll });
    } catch (error) {
      return reply.status(400).send({ message: "Invalid poll ID" });
    }
  });
}