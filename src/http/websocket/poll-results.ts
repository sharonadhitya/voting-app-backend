import { FastifyInstance } from "fastify";
import { object, string } from "zod";
import { voting } from "../../utils/voting-pub-sub";
import { prisma } from "../../lib/prisma";

export async function pollResults(app: FastifyInstance) {
  app.get(
    "/polls/:pollId/results",
    { websocket: true },
    async (connection, request) => {
      try {
        // Validate poll ID
        const getPollParams = object({
          pollId: string().trim().uuid(),
        });

        const { pollId } = getPollParams.parse(request.params);

        // Fetch initial poll data with voter information
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
                    sessionId: true,
                    createdAt: true,
                    userId: true,
                    user: {
                      select: {
                        id: true,
                        name: true,
                      }
                    }
                  }
                }
              }
            },
            user: {
              select: {
                id: true,
                name: true,
              }
            }
          }
        });

        if (!poll) {
          connection.socket.send(JSON.stringify({ error: "Poll not found" }));
          connection.socket.close();
          return;
        }

        // Transform data to include voter information
        const pollData = {
          id: poll.id,
          title: poll.title,
          createdBy: poll.user ? { id: poll.user.id, name: poll.user.name } : null,
          options: poll.options.map(option => ({
            id: option.id,
            title: option.title,
            score: option.votes.length,
            voters: option.votes.map(vote => vote.user ? { 
              id: vote.user.id, 
              name: vote.user.name 
            } : { 
              id: vote.sessionId, 
              name: 'Anonymous' 
            })
          }))
        };

        // Send initial poll state
        connection.socket.send(JSON.stringify({
          poll: pollData
        }));

        // Subscribe to real-time updates
        function onMessage(message: any) {
          if (connection.socket.readyState === 1) { // OPEN
            connection.socket.send(JSON.stringify(message));
          }
        }

        voting.subscribe(pollId, onMessage);

        // Handle connection close
        connection.socket.on("close", () => {
          voting.unsubscribe(pollId, onMessage);
        });

      } catch (error) {
        console.error("WebSocket error:", error);
        if (connection.socket.readyState === 1) { // OPEN
          connection.socket.send(JSON.stringify({ error: "Internal server error" }));
          connection.socket.close();
        }
      }
    }
  );
}