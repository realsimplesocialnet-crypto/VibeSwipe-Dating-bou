/** Small FIFO limiter for CPU- and storage-heavy work in one server process. */
export class AsyncSemaphore {
  private active = 0;
  private readonly waiters: Array<() => void> = [];
  private readonly capacity: number;

  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new Error("Semaphore capacity must be a positive integer.");
    }
    this.capacity = capacity;
  }

  get busy(): boolean {
    return this.active > 0 || this.waiters.length > 0;
  }

  async acquire(): Promise<() => void> {
    if (this.active < this.capacity) {
      this.active++;
    } else {
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }

    let released = false;
    return () => {
      if (released) return;
      released = true;
      const next = this.waiters.shift();
      if (next) next();
      else this.active--;
    };
  }
}
