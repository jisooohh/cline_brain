// FIFO process budget shared by all workflows; queued cancellation removes its waiter.
export class ProcessPool {
  constructor(limit = 6) {
    this.limit = limit;
    this.used = 0;
    this.queue = [];
  }
  acquire(signal) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(new Error("Cancelled"));
      const entry = {
        grant: () => {
          signal?.removeEventListener("abort", abort);
          this.used++;
          let released = false;
          resolve(() => {
            if (released) return;
            released = true;
            this.used--;
            this.drain();
          });
        },
      };
      const abort = () => {
        this.queue = this.queue.filter((x) => x !== entry);
        reject(new Error("Cancelled"));
      };
      signal?.addEventListener("abort", abort, { once: true });
      this.queue.push(entry);
      this.drain();
    });
  }
  drain() {
    while (this.used < this.limit && this.queue.length)
      this.queue.shift().grant();
  }
}
