import { imagePacks } from "./imagePacks";
import { ServiceKey, ImageAssignment } from "../generator/types";

export function buildImageAssignments(serviceKey: ServiceKey): ImageAssignment {
  return imagePacks[serviceKey];
}
