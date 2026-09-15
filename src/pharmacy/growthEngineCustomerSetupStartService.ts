/**
 * Customer Setup — backwards-compatible re-exports (Import Split V1).
 */
export {
  runSetupGoogleImport,
  runSetupWebsiteImport,
  runCustomerSetupStart,
  loadCustomerSetupStartDefaults,
  customerSetupConfirmUrl,
  customerSetupStartUrl,
  readSetupProfile,
} from "./growthEngineCustomerSetupImportSplitService.ts";

export { parseGooglePlaceIdFromUrl } from "./growthEngineCustomerSetupGoogleMatchService.ts";

export type CustomerSetupStartInput = {
  pharmacyName?: string;
  website?: string;
  town?: string;
  postcode?: string;
  googleBusinessUrl?: string;
  phone?: string;
};

export type CustomerSetupStartResult = {
  ok: boolean;
  slug: string;
  redirectUrl: string;
  websiteImportRan?: boolean;
  googlePlacesRan?: boolean;
  importedFieldCount?: number;
  reviewFieldCount?: number;
  warnings?: string[];
};
