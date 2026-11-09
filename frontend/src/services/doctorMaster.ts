/**
 * Imperial Hospitals doctor master -- the single roster the whole app reads.
 */

export type DoctorSection = "Main" | "Visiting"

export interface MasterDoctor {
  id: string

  name: string

  qualification: string

  specialty: string | null

  specialtyNote?: string

  section: DoctorSection

  verified: boolean

  username?: string

  room: string

  staffId: string

  selectedOnCard?: boolean

  consultationFee?: number

  /** Used to honour a patient's doctor-gender preference at OP booking. */
  gender?: "Male" | "Female"
}

/** Password every seeded local account uses -- see `demoCredentials.ts`. */

export const DOCTOR_LOCAL_PASSWORD = "password123"

export const INITIAL_DOCTOR_MASTER: MasterDoctor[] = []

export function getDefaultFeeForSpecialty(specialty?: string | null): number {
  if (!specialty) return 500
  const s = specialty.toLowerCase()
  if (s.includes("neuro")) return 800
  if (s.includes("ortho")) return 700
  if (s.includes("cardio")) return 500
  if (s.includes("gastro")) return 600
  if (s.includes("gyne") || s.includes("obg")) return 400
  if (s.includes("pedia")) return 450
  if (s.includes("urology")) return 600
  if (s.includes("oncology")) return 900
  if (s.includes("vascular")) return 750
  if (s.includes("critical")) return 700
  if (s.includes("radiology")) return 350
  if (s.includes("ent")) return 400
  return 500
}

const DOCTOR_MASTER_KEY = "hospai_doctor_master_v3"

export function getDoctorMaster(): MasterDoctor[] {
  if (typeof window === "undefined") return []

  try {
    const stored = window.localStorage.getItem(DOCTOR_MASTER_KEY)
    if (!stored) {
      window.localStorage.setItem(DOCTOR_MASTER_KEY, JSON.stringify([]))
      return []
    }

    const parsed: MasterDoctor[] = JSON.parse(stored)
    if (!Array.isArray(parsed)) {
      window.localStorage.setItem(DOCTOR_MASTER_KEY, JSON.stringify([]))
      return []
    }

    return parsed
  } catch {
    return []
  }
}

export function saveDoctorMaster(doctors: MasterDoctor[]): void {
  if (typeof window === "undefined") {
    doctors.forEach((updatedDoc) => {
      const idx = INITIAL_DOCTOR_MASTER.findIndex((d) => d.id === updatedDoc.id)
      if (idx !== -1) {
        INITIAL_DOCTOR_MASTER[idx] = updatedDoc
      } else {
        INITIAL_DOCTOR_MASTER.push(updatedDoc)
      }
    })
    return
  }

  try {
    window.localStorage.setItem(DOCTOR_MASTER_KEY, JSON.stringify(doctors))

    // Dispatch custom event for real-time update in current tab

    window.dispatchEvent(new Event("doctor_master_updated"))
  } catch (e) {
    console.error("Failed to save doctor master", e)
  }
}

export function addDoctorMaster(doctor: MasterDoctor): MasterDoctor[] {
  const current = getDoctorMaster()

  const updated = [...current, doctor]

  saveDoctorMaster(updated)

  return updated
}

export function updateDoctorMaster(
  updatedDoctor: MasterDoctor,
): MasterDoctor[] {
  const current = getDoctorMaster()

  const updated = current.map((d) =>
    d.id === updatedDoctor.id ? updatedDoctor : d,
  )

  saveDoctorMaster(updated)

  return updated
}

export function deleteDoctorMaster(id: string): MasterDoctor[] {
  const current = getDoctorMaster()

  const updated = current.filter((d) => d.id !== id)

  saveDoctorMaster(updated)

  return updated
}

/** Static fallback export for components reading DOCTOR_MASTER at top-level */

export const DOCTOR_MASTER: MasterDoctor[] = getDoctorMaster()

/** Doctors who may be shown a login, triaged to, and booked. */

export const ACTIVE_DOCTORS = DOCTOR_MASTER.filter(
  (d) => d.verified && d.specialty,
)

/** Rows the hospital still has to complete before they can be used. */

export const UNVERIFIED_DOCTORS = DOCTOR_MASTER.filter((d) => !d.verified)

/** Every specialty that has at least one usable doctor behind it. */

export const ACTIVE_SPECIALTIES = Array.from(
  new Set(ACTIVE_DOCTORS.map((d) => d.specialty as string)),
).sort()

export function getDoctorByName(name: string): MasterDoctor | undefined {
  if (!name) return undefined
  const norm = name.replace(/^Dr\.\s*/i, "").trim().toLowerCase()
  return getDoctorMaster().find(
    (d) =>
      d.name.toLowerCase() === name.toLowerCase() ||
      d.name.replace(/^Dr\.\s*/i, "").trim().toLowerCase() === norm,
  )
}

export function getDoctorConsultationFee(name: string): number {
  if (!name) return 500
  const doc = getDoctorByName(name)
  if (doc && typeof doc.consultationFee === "number" && doc.consultationFee >= 0) {
    return doc.consultationFee
  }
  return 500
}

export function doctorsForSpecialty(specialty: string): MasterDoctor[] {
  return getDoctorMaster().filter(
    (d) => d.verified && d.specialty === specialty,
  )
}

export function availabilityOf(
  doctor: MasterDoctor,
): {
  bookable: boolean

  label: string

  onRequest: boolean
} {
  if (!doctor.verified || !doctor.specialty) {
    return { bookable: false, label: "Needs verification", onRequest: false }
  }

  return doctor.section === "Main"
    ? { bookable: true, label: "Available today", onRequest: false }
    : { bookable: true, label: "On request", onRequest: true }
}

export function pickDoctorForSpecialty(
  specialty: string,

  load: (doctorName: string) => number,
): MasterDoctor | undefined {
  const candidates = doctorsForSpecialty(specialty)

  if (!candidates.length) return undefined

  const byPreference = [...candidates].sort((a, b) => {
    if (a.section !== b.section) return a.section === "Main" ? -1 : 1

    return load(a.name) - load(b.name)
  })

  return byPreference[0]
}
