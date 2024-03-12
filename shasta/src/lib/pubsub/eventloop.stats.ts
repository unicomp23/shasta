import { performance } from 'perf_hooks';
import { writeFile } from 'fs';
import fs from "fs";

export enum EventType {
  PRODUCER = 'PRODUCER',
  CONSUMER = 'CONSUMER',
}

class EventLoopStats {
  private delayThreshold = 1; // milliseconds
  private checkInterval = 20; // milliseconds
  private pauses: { timestamp: number; delta: number; type: string }[] = [];
  private scheduledTime: number;
  private eventType: EventType; // Add this line

  constructor() { // Modify this line
    const consumerFileExists = fs.existsSync('/tmp/consumer.txt');
    this.eventType = consumerFileExists ? EventType.CONSUMER : EventType.PRODUCER; // Modify this line
    this.scheduledTime = performance.now();
    this.monitorEventLoop();
  }

  private monitorEventLoop() {
    setTimeout(() => {
      const now = performance.now();
      const nowEpoch = Date.now(); // Get current time in milliseconds from the UTC epoch
      const delta = now - this.scheduledTime - this.checkInterval;

      if (delta > this.delayThreshold) { // More than 1ms over the expected delay indicates a pause
        this.pauses.push({ timestamp: nowEpoch, delta, type: this.eventType }); // Modified line
      }

      this.scheduledTime = now;
      this.monitorEventLoop(); // Schedule the next check
    }, this.checkInterval);
  }

  public getPauses() {
    return this.pauses;
  }

  public dumpPausesToJson() {
    const filePath = '/tmp/eventLoopPauses.json';
    writeFile(filePath, JSON.stringify(this.pauses, null, 2), (err) => {
      if (err) {
        console.error('Error writing pauses to file:', err);
      } else {
        console.log(`Pauses dumped to ${filePath}`);
      }
    });
  }
}

export default EventLoopStats;
