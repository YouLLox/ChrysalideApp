import { Model } from '@nozbe/watermelondb';
import { field, relation } from '@nozbe/watermelondb/decorators';

import { Attendance } from './Attendance';

export class Absence extends Model {
  static table = 'absences';

  static associations = {
    attendance: { type: 'belongs_to', key: 'attendanceId' },
  };

  @field('from') from: number;
  @field('to') to: number;
  @field('reason') reason?: string;
  @field('justified') justified: boolean;
  @field('attendanceId') attendanceId: string;
  @field('kidName') kidName: string;
  
  // New fields
  @field('slotId') slotId: string;
  @field('subjectName') subjectName: string;
  @field('mandatory') mandatory: boolean;

  @relation('attendance', 'attendanceId') attendance: Attendance;
}
