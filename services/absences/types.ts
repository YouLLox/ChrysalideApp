export interface AbsencesAPIResponse {
  levelId: number;
  semesterId: number;
  levelName: string;
  promo: number;
  periods: AbsencesPeriod[];
}

export interface AbsencesPeriod {
  id: number;
  points: number;
  grade: number;
  beginDate: string;
  endDate: string;
  absences: AbsenceItem[];
  exclusions: any[];
}

export interface AbsenceItem {
  slotId: number;
  startDate: string;
  subjectName: string;
  justificatory: string;
  mandatory: boolean;
}
