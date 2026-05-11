import { ServiceKey } from "../generator/types";

export const imagePacks: Record<ServiceKey, {
  hero: string;
  support: string;
  conversion: string;
}> = {
  web_design: {
    hero: "assets/web-design/hero-v1.png",
    support: "assets/web-design/trust-v1.png",
    conversion: "assets/web-design/conversion-v1.png"
  },
  local_seo: {
    hero: "assets/seo/hero-v1.png",
    support: "assets/seo/support-v1.png",
    conversion: "assets/seo/conversion-v1.png"
  },
  website_hosting: {
    hero: "assets/hosting/hero-v1.png",
    support: "assets/hosting/support-v1.png",
    conversion: "assets/hosting/conversion-v1.png"
  }
};
