import fs from "node:fs";
import path from "node:path";
import session from "express-session";
import type { SessionData } from "express-session";

/** File-backed session store. A new process reading the same directory keeps live sessions. */
export class FileSessionStore extends session.Store {
  private dir: string;
  constructor(dir: string) {
    super();
    this.dir = dir;
    setImmediate(() => this._prune());
  }
  private _file(sid: string): string {
    return path.join(this.dir, sid.replace(/[^a-zA-Z0-9_-]/g, "_") + ".json");
  }
  private _prune(): void {
    try {
      const now = Date.now();
      for (const f of fs.readdirSync(this.dir)) {
        if (!f.endsWith(".json")) continue;
        try {
          const raw = JSON.parse(fs.readFileSync(path.join(this.dir, f), "utf8")) as { expires?: number };
          if (raw.expires && raw.expires < now) fs.unlinkSync(path.join(this.dir, f));
        } catch { /* skip corrupt files */ }
      }
    } catch { /* non-fatal */ }
  }
  get(sid: string, cb: (err: unknown, session?: SessionData | null) => void): void {
    try {
      const file = this._file(sid);
      if (!fs.existsSync(file)) { cb(null, null); return; }
      const raw = JSON.parse(fs.readFileSync(file, "utf8")) as { expires?: number; data: SessionData };
      if (raw.expires && raw.expires < Date.now()) { fs.unlinkSync(file); cb(null, null); return; }
      cb(null, raw.data);
    } catch (e) { cb(e); }
  }
  set(sid: string, sessionData: SessionData, cb?: (err?: unknown) => void): void {
    try {
      const maxAge = (sessionData.cookie?.maxAge as number | undefined) ?? 8 * 60 * 60 * 1000;
      const expires = Date.now() + maxAge;
      fs.writeFileSync(this._file(sid), JSON.stringify({ expires, data: sessionData }));
      cb?.();
    } catch (e) { cb?.(e); }
  }
  destroy(sid: string, cb?: (err?: unknown) => void): void {
    try {
      const file = this._file(sid);
      if (fs.existsSync(file)) fs.unlinkSync(file);
      cb?.();
    } catch (e) { cb?.(e); }
  }
}
