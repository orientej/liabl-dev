export interface Group {
  id: string; name: string; activity: string; emoji: string; date: string
  total: number; signed: number; exceptions: number
  status: 'complete' | 'in_progress' | 'exceptions'
  source: 'manual' | 'fareharbor' | 'rezdy' | 'xola'
  bookingRef?: string
}
export type GroupTab = 'all' | 'roster' | 'exceptions' | 'create'
export const DEMO_GROUPS: Group[] = [
  { id:'g1', name:'Rivera Family & Friends',  activity:'Whitewater Kayaking', emoji:'🚣', date:'Today · 9:00 AM',    total:8,  signed:8,  exceptions:0, status:'complete',    source:'fareharbor', bookingRef:'RKC-4821' },
  { id:'g2', name:'Phoenix Corporate Retreat',activity:'ATV Tour',            emoji:'🏎️',  date:'Today · 11:00 AM',  total:14, signed:9,  exceptions:2, status:'exceptions',  source:'rezdy',      bookingRef:'RZ-0042'  },
  { id:'g3', name:'Sycamore Middle School',   activity:'Canyon Hiking',       emoji:'🥾', date:'Today · 2:00 PM',   total:22, signed:18, exceptions:1, status:'in_progress', source:'manual'                            },
  { id:'g4', name:'Desert Wellness Retreat',  activity:'Rock Climbing',       emoji:'🧗', date:'Tomorrow · 8:00 AM',total:6,  signed:6,  exceptions:0, status:'complete',    source:'xola',       bookingRef:'XL-8810'  },
  { id:'g5', name:'Tucson Adventure Club',    activity:'Whitewater Kayaking', emoji:'🚣', date:'Jun 5 · 9:00 AM',   total:10, signed:3,  exceptions:0, status:'in_progress', source:'manual'                            },
]
