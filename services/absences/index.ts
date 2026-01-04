import { MMKV } from "react-native-mmkv";

import { addAttendanceToDatabase } from "@/database/useAttendance";
import { Attendance, Absence } from "@/services/shared/attendance";
import { AbsencesAPIResponse, AbsenceItem } from "./types";

// Initialize MMKV storage
export const storage = new MMKV({
  id: "absences-storage",
});

const BASE_URL = "https://absences.epita.net/api";

class AbsencesAPI {
  private token: string | null = null;

  constructor(token?: string) {
    const savedToken = storage.getString("absences_token");
    if (token) {
      this.token = token;
      this.saveToken(token);
    } else if (savedToken) {
      this.token = savedToken;
    }
  }

  setToken(token: string) {
    this.token = token;
    this.saveToken(token);
  }

  private saveToken(token: string) {
    storage.set("absences_token", token);
  }

  getToken() {
    return this.token;
  }

  isLoggedIn() {
    return !!this.token;
  }

  /**
   * Syncs all data from Absences API and stores it in database.
   */
  async sync() {
    console.log("Starting Absences Sync...");

    try {
      const responses = await this.fetchGrades();
      storage.set("absences_data", JSON.stringify(responses));
      console.log(`Fetched ${responses.length} semesters.`);

      for (const semester of responses) {
        const periodName = semester.levelName; // e.g. "S1"

        // Aggregate all absences from all periods in this semester
        const allAbsences: Absence[] = [];
        
        for (const period of semester.periods) {
          for (const abs of period.absences) {
            allAbsences.push({
              id: String(abs.slotId),
              from: new Date(abs.startDate),
              to: new Date(new Date(abs.startDate).getTime() + (1.5 * 60 * 60 * 1000)), // Assuming 1h30 classes if end not provided, or simply use startDate
              // Note: The API doesn't provide end date for the slot, assuming standard duration or just start
              reason: abs.justificatory,
              timeMissed: 0, // Not provided
              justified: !!abs.justificatory,
              createdByAccount: "absences",
              // Custom fields added in database model
              // @ts-ignore
              slotId: String(abs.slotId),
              subjectName: abs.subjectName,
              mandatory: abs.mandatory,
            });
          }
        }

        const attendance: Attendance = {
          createdByAccount: "absences", // or auriga? or multiple?
          delays: [],
          absences: allAbsences,
          punishments: [],
          observations: [],
        };

        await addAttendanceToDatabase([attendance], periodName);
        console.log(`Saved ${allAbsences.length} absences for ${periodName} to database.`);
      }
      
    } catch (e) {
      console.error("Failed to sync absences:", e);
    }
  }

  async fetchGrades(): Promise<AbsencesAPIResponse[]> {
    if (!this.token) {
      throw new Error("No token provided for Absences API");
    }

    const headers: any = {
      "Authorization": `Bearer ${this.token}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    };

    const response = await fetch(`${BASE_URL}/Users/student/grades`, {
      method: "GET",
      headers: headers,
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`Absences API Error (${response.status}):`, text);
      throw new Error(`Absences API Error (${response.status})`);
    }

    return await response.json();
  }
}

export default new AbsencesAPI();
