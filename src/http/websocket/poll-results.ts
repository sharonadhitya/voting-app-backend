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
        
        // Fetch initial poll data
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
                  }
                }
              }
            }
          }
        });
        
        if (!poll) {
          connection.socket.send(JSON.stringify({ error: "Poll not found" }));
          connection.socket.close();
          return;
        }
        
        // Transform data into the format expected by the client
        const pollData = {
          id: poll.id,
          title: poll.title,
          options: poll.options.map(option => ({
            id: option.id,
            title: option.title,
            score: option.votes.length
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