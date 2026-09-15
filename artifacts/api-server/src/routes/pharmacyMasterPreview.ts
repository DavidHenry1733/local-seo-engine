import { Router } from "express";
import {
  renderPharmacyMasterPreviewPage,
  sanitiseMasterPreviewServiceId,
} from "../../../../src/pharmacy/pharmacyMasterPreviewRoute.ts";

const router = Router();

function sendPreview(res: import("express").Response, serviceId: string): void {
  const html = renderPharmacyMasterPreviewPage(serviceId);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.status(200).send(html);
}

router.get("/pharmacy-master-preview/:serviceId", (req, res) => {
  const serviceId = sanitiseMasterPreviewServiceId(req.params.serviceId);
  if (!serviceId) {
    res.status(400).send("Invalid service id");
    return;
  }
  sendPreview(res, serviceId);
});

router.get("/pharmacy-master-preview/:serviceId/", (req, res) => {
  const serviceId = sanitiseMasterPreviewServiceId(req.params.serviceId);
  if (!serviceId) {
    res.status(400).send("Invalid service id");
    return;
  }
  sendPreview(res, serviceId);
});

export default router;
