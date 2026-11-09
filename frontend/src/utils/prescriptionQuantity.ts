/**
 * Calculates medicine quantity automatically based on prescribed dose, frequency, and duration.
 * Examples:
 * - "1 tab", "1-0-1", "5 days" => 1 * 2 * 5 = 10
 * - "2 tabs", "1-1-1", "7 days" => 2 * 3 * 7 = 42
 * - "1 cap", "TDS", "3 days" => 1 * 3 * 3 = 9
 * - "1 tab", "BD", "2 weeks" => 1 * 2 * 14 = 28
 */
export function calculateMedicineQuantity(
  dosage?: string,
  frequency?: string,
  duration?: string,
): number {
  // 1. Units per dose (e.g. "1 tab", "2 tablets", "5ml" -> factor)
  let doseUnits = 1
  if (dosage) {
    const doseMatch = dosage.trim().match(/^(\d+(?:\.\d+)?)/)
    if (doseMatch) {
      const parsed = parseFloat(doseMatch[1])
      if (parsed > 0) doseUnits = parsed
    }
  }

  // 2. Frequency times per day
  let freqTimes = 1
  if (frequency) {
    const f = frequency.trim().toLowerCase()
    // Pattern like "1-0-1", "1-1-1", "1-0-0", "0-0-1", "1-1-1-1"
    if (/^\d+(?:-\d+)+$/.test(f)) {
      freqTimes = f.split("-").reduce((acc, part) => acc + (parseInt(part, 10) || 0), 0)
    } else if (f.includes("qid") || f.includes("4 times")) {
      freqTimes = 4
    } else if (f.includes("tds") || f.includes("tid") || f.includes("thrice") || f.includes("3 times")) {
      freqTimes = 3
    } else if (f.includes("bd") || f.includes("bid") || f.includes("twice") || f.includes("2 times")) {
      freqTimes = 2
    } else if (f.includes("od") || f.includes("once") || f.includes("daily") || f.includes("hs")) {
      freqTimes = 1
    } else if (f.includes("q4h")) {
      freqTimes = 6
    } else if (f.includes("q6h")) {
      freqTimes = 4
    } else if (f.includes("q8h")) {
      freqTimes = 3
    } else if (f.includes("q12h")) {
      freqTimes = 2
    } else if (f.includes("sos") || f.includes("prn")) {
      freqTimes = 1
    }
  }
  if (freqTimes <= 0) freqTimes = 1

  // 3. Duration in days
  let durationDays = 5 // standard default clinical duration
  if (duration) {
    const d = duration.trim().toLowerCase()
    const numMatch = d.match(/(\d+(?:\.\d+)?)/)
    const num = numMatch ? parseFloat(numMatch[1]) : 0
    if (num > 0) {
      if (d.includes("month")) {
        durationDays = Math.round(num * 30)
      } else if (d.includes("week")) {
        durationDays = Math.round(num * 7)
      } else {
        durationDays = Math.round(num)
      }
    }
  }

  const total = Math.round(doseUnits * freqTimes * durationDays)
  return Math.max(1, total)
}
