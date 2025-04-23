// src/utils/voting-pub-sub.ts
import { Redis } from "ioredis";

export const voting = {
  publish: (pollId: string, message: any) => {
    console.log(`Publishing to Redis channel ${pollId}:`, message);
    const redis = new Redis({
      host: "localhost",
      port: 6379,
    });
    redis.publish(pollId, JSON.stringify(message));
    redis.quit();
  },
  subscribe: (pollId: string, callback: (message: any) => void) => {
    const redis = new Redis({
      host: "localhost",
      port: 6379,
    });
    redis.subscribe(pollId, (err, count) => {
      if (err) {
        console.error(`Failed to subscribe to ${pollId}:`, err);
      } else {
        console.log(`Subscribed to Redis channel ${pollId}, count: ${count}`);
      }
    });
    redis.on("message", (channel, message) => {
      if (channel === pollId) {
        console.log(`Received message from Redis channel ${pollId}:`, message);
        callback(JSON.parse(message));
      }
    });
    return () => {
      redis.unsubscribe(pollId);
      redis.quit();
      console.log(`Unsubscribed from Redis channel ${pollId}`);
    };
  },
};