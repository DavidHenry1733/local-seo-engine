import { buildPagePayload } from "./src/generator/buildPagePayload";

const project:any = {
  brand: "InboxingProWeb",
  businessAddress: "Moorgate Crofts Business Centre, South Grove, Rotherham, S60 2DH",
  primaryCtaText: "Request a Quote",
  primaryCtaUrl: "/contact/"
};

const areaConfig:any = {
  primaryCity: "Sheffield",
  coreAreas: ["Ecclesall","Fulwood","Hillsborough"],
  priorityAreas: ["Ecclesall","Fulwood","Hillsborough"],
  areaProfiles: {}
};

const allPages:any[] = [];

for (const location of areaConfig.coreAreas) {

  const page:any = {
    serviceKey: "web_design",
    serviceLabel: "Web Design",
    location,
    pageRole: "area",
    areaConfig
  };

  const payload = buildPagePayload(project,page,allPages);

  console.log("\\n====================");
  console.log(location);
  console.log("====================");

  for (const s of payload.sections) {
    console.log(s.id);
  }
}
