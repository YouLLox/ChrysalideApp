import { Multi as EsupMulti } from "esup-multi.js";

import { Auth, Services } from "@/stores/account/types";
import { error } from "@/utils/logger/logger";

import { News } from "../shared/news";
import { CourseDay } from "../shared/timetable";
import { Capabilities, SchoolServicePlugin } from "../shared/types";
import { fetchMultiNews } from "./news";
import { refreshMultiSession } from "./refresh";
import { fetchMultiTimetable } from "./timetable";
import AurigaAPI from "../auriga";
import { Period, PeriodGrades } from "../shared/grade";

export class Multi implements SchoolServicePlugin {
  displayName = "Multi";
  service = Services.MULTI;
  capabilities: Capabilities[] = [
    Capabilities.REFRESH,
    Capabilities.NEWS,
    Capabilities.TIMETABLE,
  ];
  session: EsupMulti | undefined = undefined;
  authData: Auth = {};

  // Track if this is an Auriga account
  private isAuriga = false;

  constructor(public accountId: string) {}

  async refreshAccount(credentials: Auth): Promise<Multi> {
    const refresh = await refreshMultiSession(this.accountId, credentials);

    this.authData = refresh.auth;
    this.session = refresh.session; // This will be undefined for Auriga as per our refresh.ts change

    if (credentials.additionals?.type === "auriga") {
      this.isAuriga = true;
      this.capabilities = [Capabilities.REFRESH, Capabilities.GRADES];

      // Initialize API with credentials
      if (credentials.accessToken) {
        AurigaAPI.setToken(credentials.accessToken);
      }
      if (
        credentials.additionals.cookies &&
        typeof credentials.additionals.cookies === "string"
      ) {
        AurigaAPI.setCookie(credentials.additionals.cookies);
      }
    }

    return this;
  }

  async getNews(): Promise<News[]> {
    if (this.isAuriga) return []; // Auriga doesn't support news yet
    if (this.session) {
      return fetchMultiNews(this.session, this.accountId);
    }
    error("Session is not valid", "Multi.getNews");
    throw new Error("Session is not valid");
  }

  async getWeeklyTimetable(weekNumber: number): Promise<CourseDay[]> {
    if (this.isAuriga) return []; // Not implemented for Auriga yet
    if (this.session) {
      return fetchMultiTimetable(this.session, this.accountId, weekNumber);
    }
    error("Session is not valid", "Multi.getWeeklyTimetable");
    throw new Error("Session is not valid");
  }

  // --- Auriga Specific Implementations ---

  async getGradesPeriods(): Promise<Period[]> {
    if (!this.isAuriga) return [];

    const grades = AurigaAPI.getAllGrades();
    // Extract unique semesters
    const semesters = Array.from(
      new Set(grades.map(g => g.semester).filter(s => s > 0))
    ).sort((a, b) => b - a);

    return semesters.map(s => ({
      id: `S${s}`,
      name: `Semestre ${s}`,
      start: new Date().toISOString(), // Dummies for now
      end: new Date().toISOString(),
    }));
  }

  async getGradesForPeriod(period: Period): Promise<PeriodGrades> {
    if (!this.isAuriga) return { period: period.id, grades: [], averages: [] };

    const semesterNum = parseInt(period.id.replace("S", ""));
    const grades = AurigaAPI.getAllGrades().filter(
      g => g.semester === semesterNum
    );

    return {
      period: period.id,
      grades: grades.map(g => ({
        id: g.name + g.date, // Approximate ID
        name: g.name,
        grade: {
          value: parseFloat(g.grade),
          outOf: 20,
        },
        date: new Date().toISOString(),
        coefficient: 1,
        subject: {
          name: g.name || "Matière inconnue",
          color: "#000000",
        },
      })),
      averages: [],
    };
  }
}
