/**
 * Breaks the jobService ↔ jobWorker circular import while guaranteeing enqueue wakes the worker.
 */
type WorkerWakeHandler = () => void;

let wakeHandler: WorkerWakeHandler | null = null;

/** Warm the worker module during app boot so enqueue never waits on a cold dynamic import. */
const workerModuleReady = import("./masterAdminJobWorkerService.ts").catch((err) => {
  console.error("Master Admin job worker module preload failed", err);
  return null;
});

export function registerMasterAdminJobWorkerWake(handler: WorkerWakeHandler): void {
  wakeHandler = handler;
}

export function isMasterAdminJobWorkerWakeRegistered(): boolean {
  return wakeHandler !== null;
}

export function wakeMasterAdminJobWorkerAfterEnqueue(): void {
  if (wakeHandler) {
    wakeHandler();
    return;
  }
  void workerModuleReady.then((mod) => {
    if (!mod) return;
    mod.startMasterAdminJobWorker();
    mod.wakeMasterAdminJobWorker();
  });
}
