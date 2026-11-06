/**
 * Official Radiology Catalogue & Rate Master Data for Imperial Hospitals.
 * Replaces legacy ad-hoc scans with the comprehensive 11-category clinical examination catalogue.
 *
 * Categories:
 * 1. X-Ray / Radiography (39 core examinations)
 * 2. CT Scan (24 examination variants & protocols)
 * 3. MRI / MR Imaging (21 examinations)
 * 4. Ultrasound / USG (17 examinations)
 * 5. Doppler Studies (11 examinations)
 * 6. Mammography and Breast Imaging (8 examinations)
 * 7. Fluoroscopy and Contrast Studies (11 examinations)
 * 8. Nuclear Medicine / PET / SPECT (8 examinations)
 * 9. DEXA / Bone Densitometry (13 examinations)
 * 10. Dental / Maxillofacial Imaging (11 examinations)
 * 11. Interventional Radiology / Image-Guided Procedures (7 examinations)
 * 12. Additional Reconciled Examinations & Combined Views (3 items)
 */

import { DiagnosticTariffItem } from "./diagnosticTariffDb"

export const RADIOLOGY_MODALITIES = [
  "X-Ray",
  "CT Scan",
  "MRI",
  "Ultrasound (USG)",
  "Doppler",
  "Mammography",
  "Fluoroscopy / Contrast",
  "Nuclear Medicine",
  "DEXA",
  "Dental",
  "Interventional Radiology",
] as const

export type RadiologyModality = (typeof RADIOLOGY_MODALITIES)[number]

export const INITIAL_RADIOLOGY_TARIFFS: Omit<DiagnosticTariffItem, "id">[] = []
