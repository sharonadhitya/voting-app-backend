import { FastifyInstance } from "fastify";
import { object, string } from "zod";
import { voting } from "../../utils/voting-pub-sub";
import { prisma } from "../../lib/prisma";

export async function pollResults(app: FastifyInstance) {
  app.get("/polls/:pollId/results", { websocket: true }, async (connection, request) => {
    try {
      const getPollParams = object({ pollId: string().trim().uuid() });
      const { pollId } = getPollParams.parse(request.params);

      const poll = await prisma.poll.findUnique({
        where: { id: pollId },
        include: {
          options: {
            select: {
              id: true,
              title: true,
              votes: {
                select: {
                  id: true,
                  sessionId: true,
                  createdAt: true,
                  userId: true,
                  user: { select: { id: true, name: true } },
                },
              },
            },
          },
          user: { select: { id: true, name: true } },
        },
      });

      if (!poll) {
        if (connection.socket && connection.socket.readyState === 1) {
          connection.socket.send(JSON.stringify({ error: "Poll not found" }));
        }
        if (connection.socket) connection.socket.close();
        return;
      }

      const pollData = {
        id: poll.id,
        title: poll.title,
        createdBy: poll.user ? { id: poll.user.id, name: poll.user.name } : null,
        options: poll.options.map(option => ({
          id: option.id,
          title: option.title,
          score: option.votes.length,
          voters: option.votes.map(vote =>
            vote.user
              ? { id: vote.user.id, name: vote.user.name }
              : { id: vote.sessionId, name: 'Anonymous' }
          ),
        })),
      };

      if (connection.socket && connection.socket.readyState === 1) {
        connection.socket.send(JSON.stringify({ poll: pollData }));
      }

      function onMessage(message: any) {
        if (connection.socket && connection.socket.readyState === 1) {
          connection.socket.send(JSON.stringify(message));
        }
      }

      voting.subscribe(pollId, onMessage);

      connection.socket.on("close", () => {
        voting.unsubscribe(pollId, onMessage);
      });
    } catch (error) {
      console.error("WebSocket error:", error);
      if (connection.socket && connection.socket.readyState === 1) {
        connection.socket.send(JSON.stringify({ error: "Internal server error" }));
      }
      if (connection.socket) connection.socket.close();
    }
  });
}