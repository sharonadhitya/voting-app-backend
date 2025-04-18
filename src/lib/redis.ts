import { Redis } from "ioredis";
import { config } from "../config/index.schema";

export const redis = new Redis({
  port: config.REDIS_PORT,
  host: "localhost",
  // Add retryStrategy to handle connection issues
  retryStrategy: (times) => {
    return Math.min(times * 50, 2000);
  }
});

// Add error handling
redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});