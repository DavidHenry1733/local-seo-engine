import { Router } from "express";
import {
  renderPharmacyResearchPreviewPage,
  sanitiseResearchPreviewServiceId,
} from "../../../../src/pharmacy/pharmacyResearchPreviewRoute.ts";

const router = Router();

function sendPreview(res: import("express").Response, serviceId: string): void {
  const html = renderPharmacyResearchPreviewPage(serviceId);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.status(200).send(html);
}

router.get("/pharmacy-research-preview/:serviceId", (req, res) => {
  const serviceId = sanitiseResearchPreviewServiceId(req.params.serviceId);
  if (!serviceId) {
    res.status(400).send("Invalid service id");
    return;
  }
  sendPreview(res, serviceId);
});

router.get("/pharmacy-research-preview/:serviceId/", (req, res) => {
  const serviceId = sanitiseResearchPreviewServiceId(req.params.serviceId);
  if (!serviceId) {
    res.status(400).send("Invalid service id");
    return;
  }
  sendPreview(res, serviceId);
});

export default router;
