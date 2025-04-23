// src/websocket/poll-results.ts
import { Server, Socket } from "socket.io";
import { object, string } from "zod";
import { prisma } from "../../lib/prisma";
import { voting } from "../../utils/voting-pub-sub";
import { verifyToken } from "../../lib/jwt";

export async function setupSocket(io: Server) {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    console.log("Socket auth token:", token);
    if (!token) {
      console.log("Socket authentication failed: No token");
      return next(new Error("Authentication required"));
    }
    const payload = verifyToken(token);
    console.log("Socket token payload:", payload);
    if (!payload) {
      console.log("Socket authentication failed: Invalid token");
      return next(new Error("Invalid or expired token"));
    }
    (socket as any).userId = payload.userId;
    next();
  });

  io.on("connection", (socket: Socket) => {
    console.log("Socket.IO client connected:", socket.id);

    socket.on("joinPoll", async (data: { pollId: string }) => {
      try {
        const getPollParams = object({ pollId: string().trim().uuid() });
        const { pollId } = getPollParams.parse(data);

        socket.join(pollId);
        console.log(`Client ${socket.id} joined poll room ${pollId}`);
        console.log(`Clients in room ${pollId}:`, io.sockets.adapter.rooms.get(pollId)?.size || 0);

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
          socket.emit("error", { message: "Poll not found" });
          return;
        }

        const pollData = {
          id: poll.id,
          title: poll.title,
          createdBy: poll.user ? { id: poll.user.id, name: poll.user.name } : null,
          options: poll.options.map((option) => ({
            id: option.id,
            title: option.title,
            score: option.votes.length,
            voters: option.votes.map((vote) =>
              vote.user
                ? { id: vote.user.id, name: vote.user.name }
                : { id: vote.sessionId, name: "Anonymous" }
            ),
          })),
        };

        socket.emit("pollUpdate", { poll: pollData });

        const onMessage = (message: any) => {
          console.log(`Broadcasting voteUpdate to room ${pollId}:`, message);
          io.to(pollId).emit("voteUpdate", message);
        };

        // Store the cleanup function returned by subscribe
        const unsubscribe = voting.subscribe(pollId, onMessage);

        socket.on("disconnect", () => {
          console.log(`Client ${socket.id} disconnected from poll ${pollId}`);
          unsubscribe(); // Call the cleanup function
        });
      } catch (error) {
        console.error("Socket.IO error:", error);
        socket.emit("error", { message: "Invalid poll ID" });
      }
    });
  });
}