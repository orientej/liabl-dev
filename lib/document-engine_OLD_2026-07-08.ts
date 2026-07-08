export type ActivityKey = 'kayak' | 'hike' | 'atv' | 'climb'

// v23 M1 fix #3 — multi-condition health disclosure
// HealthStatus is now an array; a participant can disclose multiple conditions
// (e.g., both cardiac AND injury). Empty array = no known conditions.
export type HealthCondition = 'cardiac' | 'injury'
export type HealthStatus = HealthCondition[]

export interface ParticipantAnswers {
  fullName: string
  // v23 M1 fix #4 — dob is an ISO date string (YYYY-MM-DD) when populated
  // The schema migration changes the column type from text to date; the
  // frontend now produces ISO format from a real date picker.
  dob: string
  email: string
  activityKey: ActivityKey
  healthStatus: HealthStatus
  isMinor: boolean
  guardianName?: string
}
export interface WaiverClause {
  id: string; title: string; body: string; highlight?: boolean; required: boolean
}
export const ACTIVITY_LABELS: Record<ActivityKey, string> = {
  kayak:'Whitewater Kayaking', hike:'Canyon Hiking', atv:'ATV Tour', climb:'Rock Climbing',
}
function baseClauses(name: string, activity: string, date: string): WaiverClause[] {
  return [
    { id:'assumption', title:'Assumption of Risk', required:true, body:`I, ${name}, acknowledge that ${activity} involves inherent risks and hazards. I voluntarily assume full responsibility for all risks of loss, property damage, or personal injury that may be sustained as a result of my participation.` },
    { id:'release', title:'Release of Liability', required:true, body:`I hereby release, waive, and discharge the operator from any and all liability, claims, and actions arising out of or related to any loss, damage, or injury sustained while participating in ${activity} on ${date}.` },
    { id:'emergency', title:'Emergency Medical Authorization', required:true, body:`In the event of an emergency, I authorize operator staff to secure emergency medical services on my behalf. I accept financial responsibility for any emergency medical treatment rendered.` },
    { id:'equipment', title:'Equipment & Safety Briefing', required:true, body:`I confirm receipt of a full safety briefing and proper fitting of all required safety equipment prior to activity commencement.` },
    { id:'governing_law', title:'Governing Law', required:true, body:`This agreement shall be governed by the laws of the State of Arizona. Any disputes shall be resolved in the courts of Maricopa County, Arizona.` },
  ]
}
const activityClauses: Record<ActivityKey, WaiverClause> = {
  kayak: { id:'water', title:'Water Hazards Acknowledgment', highlight:true, required:true, body:'I understand that whitewater kayaking involves exposure to fast-moving water, submerged obstacles, and potential for capsize. I confirm I am a capable swimmer and acknowledge that Class III–IV rapids present serious risk of injury or death.' },
  hike:  { id:'terrain', title:'Terrain & Environmental Hazards', highlight:true, required:true, body:'I understand that canyon hiking involves uneven terrain, extreme temperatures, flash flood risk, and limited emergency access. I confirm I am physically capable of completing the stated route.' },
  atv:   { id:'vehicle', title:'Motor Vehicle Operation', highlight:true, required:true, body:'I understand that ATV operation involves risk of rollover, collision, and ejection. I confirm I will comply with all speed limits and route restrictions and will not operate under the influence of any substance.' },
  climb: { id:'fall', title:'Fall & Equipment Hazards', highlight:true, required:true, body:'I understand that rock climbing involves risk of falls and equipment failure. I confirm I have received and understood the safety briefing for all anchor systems, belay devices, and harness equipment.' },
}

// v23 M1 fix #3 — generate one conditional clause per disclosed condition.
// Order: cardiac clause first (more legally significant), then injury clause.
// Both can be inserted simultaneously when the participant discloses both.
const conditionClauses: Record<HealthCondition, (name: string) => WaiverClause> = {
  cardiac: (name) => ({
    id:'cardiac', title:'Physician Clearance — Cardiovascular Condition', highlight:true, required:true,
    body:`${name} has disclosed a cardiovascular or respiratory condition. Participant confirms written physician clearance within 30 days. Participation without valid clearance voids this waiver.`,
  }),
  injury: (name) => ({
    id:'injury', title:'Recent Injury Disclosure', highlight:true, required:true,
    body:`${name} has disclosed a recent injury or surgery. Participant confirms physician clearance for physical activity of this intensity.`,
  }),
}

export function generateClauses(answers: ParticipantAnswers): WaiverClause[] {
  const date = new Date().toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' })
  const clauses = [...baseClauses(answers.fullName, ACTIVITY_LABELS[answers.activityKey], date), activityClauses[answers.activityKey]]

  // v23 M1 fix #3 — iterate over the array, insert each clause after Emergency Medical (position 2)
  // Insertion order preserved: cardiac before injury for consistent clause ordering.
  const ordered: HealthCondition[] = ['cardiac', 'injury']
  let insertAt = 2
  for (const condition of ordered) {
    if (answers.healthStatus?.includes(condition)) {
      clauses.splice(insertAt, 0, conditionClauses[condition](answers.fullName))
      insertAt++
    }
  }

  if (answers.isMinor && answers.guardianName) {
    clauses.push({ id:'minor', title:'Guardian Authorization', highlight:true, required:true, body:`${answers.guardianName} grants permission for minor ${answers.fullName} to participate and agrees to all terms of this waiver on their behalf.` })
  }
  return clauses
}
