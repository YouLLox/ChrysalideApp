import { MMKV } from "react-native-mmkv";

import {
  GRADES_PAYLOAD,
  SYLLABUS_PAYLOAD,
  SYLLABUS2_PAYLOAD,
} from "./payloads";
import { Grade, Syllabus, UserData } from "./types";

// Initialize MMKV storage
export const storage = new MMKV({
  id: "auriga-storage",
});

const BASE_URL = "https://auriga.epita.fr/api/main";

class AurigaAPI {
  private token: string | null = null;
  private cookie: string | null = null;

  constructor(token?: string) {
    if (token) {
      this.token = token;
    }
  }

  setToken(token: string) {
    this.token = token;
  }

  setCookie(cookie: string) {
    this.cookie = cookie;
  }

  /**
   * Syncs all data from Auriga (Grades, Syllabus) and stores it in local storage.
   * Note: UserData fetching is currently skipped as we don't have a reliable endpoint.
   */
  async sync() {
    console.log("Starting Auriga Sync...");

    // 1. Fetch Grades
    console.log("Fetching Grades...");
    const grades = await this.fetchAllGrades();
    storage.set("auriga_grades", JSON.stringify(grades));
    console.log(`Fetched ${grades.length} grades.`);

    // 2. Fetch Syllabus
    console.log("Fetching Syllabus...");
    const syllabus = await this.fetchAllSyllabus();
    storage.set("auriga_syllabus", JSON.stringify(syllabus));
    console.log(`Fetched ${syllabus.length} syllabus items.`);

    // We return what we have. UserData will be null/undefined for now.
    return { grades, syllabus, userData: null };
  }

  // --- Getters (from Storage) ---

  getStudentData(): UserData | null {
    const data = storage.getString("auriga_userdata");
    return data ? JSON.parse(data) : null;
  }

  getAllGrades(): Grade[] {
    const data = storage.getString("auriga_grades");
    return data ? JSON.parse(data) : [];
  }

  getGradeByCode(code: string): Grade | undefined {
    return this.getAllGrades().find(g => g.code.toString() === code);
  }

  getAllSyllabus(): Syllabus[] {
    const data = storage.getString("auriga_syllabus");
    return data ? JSON.parse(data) : [];
  }

  getSyllabusBySemester(semester: number): Syllabus[] {
    return this.getAllSyllabus().filter(s => s.semester === semester);
  }

  // --- Fetch Implementation ---

  private async postDataToAuriga(endpoint: string, payload: any) {
    const headers: any = {
      "Content-Type": "application/json",
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    if (this.cookie) {
      headers["Cookie"] = this.cookie;
    }

    const response = await fetch(`${BASE_URL}/${endpoint}`, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(payload),
    });

    const contentType = response.headers.get("content-type");
    if (!response.ok || (contentType && contentType.includes("text/html"))) {
      const text = await response.text();
      console.error(
        `Auriga API Error [${endpoint}] (${response.status}):`,
        text.substring(0, 200)
      );
      throw new Error(`Auriga API Error (${response.status}) on ${endpoint}`);
    }

    return await response.json();
  }

  private async getDataFromAuriga(endpoint: string) {
    const headers: any = {
      "Content-Type": "application/json",
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    if (this.cookie) {
      headers["Cookie"] = this.cookie;
    }

    const response = await fetch(`${BASE_URL}/${endpoint}`, {
      method: "GET",
      headers: headers,
    });

    const contentType = response.headers.get("content-type");
    if (!response.ok || (contentType && contentType.includes("text/html"))) {
      const text = await response.text();
      console.error(
        `Auriga API Error [${endpoint}] (${response.status}):`,
        text.substring(0, 200)
      );
      throw new Error(`Auriga API Error (${response.status}) on ${endpoint}`);
    }

    return await response.json();
  }

  // Removed fetchStudentData("users/current") as it appears invalid

  private async fetchAllGrades(): Promise<Grade[]> {
    const response = await this.postDataToAuriga(
      "menuEntries/1036/searchResultRows?page=1&perPage=100000",
      GRADES_PAYLOAD
    );

    if (!response || !response.rows) {
      return [];
    }

    const grades: Grade[] = response.rows
      .map((row: any) => {
        const gradeValue = row.data[6];
        if (gradeValue === null) {
          return null;
        }

        return {
          code: row.data[8],
          type: row.data[9],
          name: row.data[12],
          semester: row.data[14] ? parseInt(row.data[14].replace("S", "")) : 0,
          grade: gradeValue,
        };
      })
      .filter((g: any) => g !== null);

    return grades;
  }

  private async fetchAllSyllabus(): Promise<Syllabus[]> {
    // 1. Fetch Syllabus 1
    const response1 = await this.postDataToAuriga(
      "menuEntries/166/searchResultRows?page=1&perPage=100000",
      SYLLABUS_PAYLOAD
    );
    // 2. Fetch Syllabus 2
    const response2 = await this.postDataToAuriga(
      "menuEntries/166/searchResultRows?page=1&perPage=100000",
      SYLLABUS2_PAYLOAD
    );

    // Filter and combine
    const rows1 =
      response1?.rows?.filter((r: any) => r.data[35] !== "441674") || []; // 441674 seems to be rejected status?
    const rows2 = response2?.rows || [];

    // Map function
    const mapSyllabus = (row: any): Syllabus | null => {
      return {
        id: row.data[0],
        UE: "Unknown",
        semester: row.data[15] ? parseInt(row.data[15].replace("S", "")) : 0,
        name: row.data[3],
        code: row.data[2],
        minScore: row.data[32],
        duration: row.data[31],
        period: {
          startDate: row.data[4],
          endDate: row.data[5],
        },
        exams: [],
        courseDescription: {
          coursPlan: { fr: row.data[42] }, // Program
          expected: [{ fr: row.data[41] }], // Goals?
        },
        caption: {
          name: row.data[3],
          goals: { fr: row.data[41] },
          program: { fr: row.data[42] },
        },
        responsables: [],
        instructorsValidator: [],
        instructorsEditors: [],
        activities: [],
        locations: [],
      };
    };

    const syllabus1 = rows1.map(mapSyllabus);
    const syllabus2 = rows2.map(mapSyllabus);

    return [...syllabus1, ...syllabus2];
  }
}

export default new AurigaAPI();
