import { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma";
import { authenticate } from "../middleware/auth";

export async function getAllPolls(app: FastifyInstance) {
  app.get("/polls", async (request, reply) => {
    const polls = await prisma.poll.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        options: true,
        user: {
          select: {
            id: true,
            name: true
          }
        }
      },
    });
    
    return polls;
  });
  
  // Add a route to get polls created by the current user
  app.get("/polls/my", { preHandler: authenticate }, async (request, reply) => {
    const userId = (request as any).userId;
    
    const polls = await prisma.poll.findMany({
      where: {
        userId
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        options: true,
        user: {
          select: {
            id: true,
            name: true
          }
        }
      },
    });
    
    return polls;
  });
}