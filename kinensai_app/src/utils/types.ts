export type DayType = 'saturday' | 'sunday';

export interface TimeSlot {
  start: string;
  end: string;
  capacity: number;
  reservedCount: number;
}

export interface Exhibition {
  id: string;
  day: DayType;
  className: string;
  projectName: string;
  description: string;
  timeSlots: TimeSlot[];
}
