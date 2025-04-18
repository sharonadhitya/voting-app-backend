import jwt from 'jsonwebtoken';
import { config } from '../config/index.schema';

// Add JWT_SECRET to your config schema and .env
// In index.schema.ts:
// JWT_SECRET: string({ required_error: "JWT secret is mandatory!" }).trim(),

export function generateToken(userId: string): string {
  return jwt.sign({ userId }, config.JWT_SECRET, {
    expiresIn: '7d',
  });
}

export function verifyToken(token: string): { userId: string } | null {
  try {
    return jwt.verify(token, config.JWT_SECRET) as { userId: string };
  } catch (error) {
    return null;
  }
}