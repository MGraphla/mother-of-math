import type { UserProfile } from "../types";

export const getDashboardRouteByRole = (profile: Pick<UserProfile, "role"> | null): string => {
  switch (profile?.role) {
    case "admin":
      return "/(roles)/admin";
    case "student":
      return "/(roles)/student";
    case "parent":
      return "/(roles)/parent";
    case "monitor":
      return "/(roles)/monitor";
    case "teacher":
    default:
      return "/(roles)/teacher";
  }
};
