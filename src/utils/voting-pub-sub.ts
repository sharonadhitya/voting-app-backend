type Message = { pollOptionId: string; votes: number };
type Subscriber = (message: Message) => void;

class VotingPubSub {
  private channels: Record<string, Subscriber[]> = {};

  subscribe(pollId: string, subscriber: Subscriber) {
    if (!this.channels[pollId]) {
      this.channels[pollId] = [];
    }
    this.channels[pollId].push(subscriber);
  }

  unsubscribe(pollId: string, subscriber: Subscriber) {
    if (!this.channels[pollId]) {
      return;
    }
    
    this.channels[pollId] = this.channels[pollId].filter(
      existingSubscriber => existingSubscriber !== subscriber
    );
    
    // Clean up empty channels
    if (this.channels[pollId].length === 0) {
      delete this.channels[pollId];
    }
  }

  publish(pollId: string, message: Message) {
    if (!this.channels[pollId]) {
      return;
    }
    
    for (const subscriber of this.channels[pollId]) {
      subscriber(message);
    }
  }
}

export const voting = new VotingPubSub();