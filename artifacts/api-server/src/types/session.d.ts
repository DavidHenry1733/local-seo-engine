import "express-session";

declare module "express-session" {
  interface SessionData {
    userId:   string;
    username: string;
    userRole: "admin" | "staff";
    userName: string;
  }
}
