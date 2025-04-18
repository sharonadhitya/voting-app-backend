import { FastifyInstance } from "fastify";
import { object, string } from "zod";
import { prisma } from "../../lib/prisma";
import bcrypt from 'bcrypt';
import { generateToken , verifyToken} from "../../lib/jwt";

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/register", async (request, reply) => {
    const registerBody = object({
      name: string().trim().min(2),
      email: string().trim().email(),
      password: string().min(6),
    });

    try {
      const { name, email, password } = registerBody.parse(request.body);

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email }
      });

      if (existingUser) {
        return reply.status(400).send({ message: "User already exists with this email" });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create user
      const user = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash,
        }
      });

      // Generate token
      const token = generateToken(user.id);

      return reply.status(201).send({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
        token,
      });
    } catch (error) {
      return reply.status(400).send({ message: "Invalid registration data" });
    }
  });

  app.post("/auth/login", async (request, reply) => {
    const loginBody = object({
      email: string().trim().email(),
      password: string(),
    });

    try {
      const { email, password } = loginBody.parse(request.body);

      // Find user
      const user = await prisma.user.findUnique({
        where: { email }
      });

      if (!user) {
        return reply.status(401).send({ message: "Invalid credentials" });
      }

      // Verify password
      const passwordValid = await bcrypt.compare(password, user.passwordHash);

      if (!passwordValid) {
        return reply.status(401).send({ message: "Invalid credentials" });
      }

      // Generate token
      const token = generateToken(user.id);

      return reply.send({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
        token,
      });
    } catch (error) {
      return reply.status(400).send({ message: "Invalid login data" });
    }
  });

  // Get current authenticated user info
  app.get("/auth/me", async (request, reply) => {
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ message: "Authentication required" });
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);

    if (!payload) {
      return reply.status(401).send({ message: "Invalid or expired token" });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId }
    });

    if (!user) {
      return reply.status(401).send({ message: "User not found" });
    }

    return reply.send({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      }
    });
  });
}
