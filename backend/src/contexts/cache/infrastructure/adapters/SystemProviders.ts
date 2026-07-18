import { TimeProvider, SleepProvider } from "../../application/ports/out/CachePorts.ts";

export class SystemTimeProvider implements TimeProvider {
  now(): number {
    return Date.now();
  }
}

export class AsyncSleepProvider implements SleepProvider {
  sleep(delayMs: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}
