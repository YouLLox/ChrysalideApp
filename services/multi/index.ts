import { Multi as EsupMulti } from "esup-multi.js";

import { Auth, Services } from "@/stores/account/types";
import { error } from "@/utils/logger/logger";

import AurigaAPI from "../auriga";
import {
  Grade as SharedGrade,
  Period,
  PeriodGrades,
  Subject,
} from "../shared/grade";
import { News } from "../shared/news";
import { CourseDay } from "../shared/timetable";
import { Capabilities, SchoolServicePlugin } from "../shared/types";
import { fetchMultiNews } from "./news";
import { refreshMultiSession } from "./refresh";
import { fetchMultiTimetable } from "./timetable";

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
    this.session = refresh.session;

    if (credentials.additionals?.type === "auriga") {
      this.isAuriga = true;
      this.capabilities = [Capabilities.REFRESH, Capabilities.GRADES];

      if (credentials.accessToken) {
        AurigaAPI.setToken(credentials.accessToken);
      }
      if (
        credentials.additionals.cookies &&
        typeof credentials.additionals.cookies === "string"
      ) {
        AurigaAPI.setCookie(credentials.additionals.cookies);
      }

      await AurigaAPI.sync();
    }

    return this;
  }

  async getNews(): Promise<News[]> {
    if (this.isAuriga) {
      return [];
    }
    if (this.session) {
      return fetchMultiNews(this.session, this.accountId);
    }
    error("Session is not valid", "Multi.getNews");
    throw new Error("Session is not valid");
  }

  async getWeeklyTimetable(weekNumber: number): Promise<CourseDay[]> {
    if (this.isAuriga) {
      return [];
    }
    if (this.session) {
      return fetchMultiTimetable(this.session, this.accountId, weekNumber);
    }
    error("Session is not valid", "Multi.getWeeklyTimetable");
    throw new Error("Session is not valid");
  }

  // --- Auriga Specific Implementations ---

  async getGradesPeriods(): Promise<Period[]> {
    if (!this.isAuriga) {
      return [];
    }

    const grades = AurigaAPI.getAllGrades();
    const semesters = Array.from(
      new Set(grades.map(g => g.semester).filter(s => s > 0))
    ).sort((a, b) => b - a);

    return semesters.map(s => ({
      id: `S${s}`,
      name: `Semestre ${s}`,
      start: new Date(),
      end: new Date(),
      createdByAccount: this.accountId,
    }));
  }

  async getGradesForPeriod(period: Period): Promise<PeriodGrades> {
    if (!this.isAuriga) {
      return {
        studentOverall: { value: 0 },
        classAverage: { value: 0 },
        subjects: [],
        createdByAccount: this.accountId,
      };
    }

    const semesterNum = period.id ? parseInt(period.id.replace("S", "")) : 0;
    const grades = AurigaAPI.getAllGrades().filter(
      g => g.semester === semesterNum
    );

    const subjectsMap: Record<string, Subject> = {};

    grades.forEach(g => {
      // Group by Name (e.g. "Algorithmique")
      // Auriga payload "name" seems to be the Module name, or code?
      // User says: property {string} name
      const subjectName = g.name || "Unknown";

      if (!subjectsMap[subjectName]) {
        subjectsMap[subjectName] = {
          id: subjectName,
          name: subjectName,
          studentAverage: { value: 0 },
          classAverage: { value: 0 },
          outOf: { value: 20 },
          grades: [],
        };
      }

      const gradeItem: SharedGrade = {
        id: String(g.code),
        subjectId: subjectName,
        subjectName: subjectName,
        description: g.type, // e.g. "Exam", "Project"
        givenAt: new Date(), // Mock date
        studentScore: { value: g.grade },
        outOf: { value: 20 },
        coefficient: 1,
        createdByAccount: this.accountId,
      };

      subjectsMap[subjectName].grades?.push(gradeItem);
    });

    // Calculate averages per subject
    Object.values(subjectsMap).forEach(s => {
      const sGrades = s.grades || [];
      const total = sGrades.reduce(
        (acc, curr) => acc + (curr.studentScore?.value || 0),
        0
      );
      s.studentAverage = {
        value: sGrades.length > 0 ? total / sGrades.length : 0,
        outOf: 20,
      };
    });

    const subjects = Object.values(subjectsMap);

    // Calculate overall average
    let overallTotal = 0;
    let overallCount = 0;
    subjects.forEach(s => {
      overallTotal += s.studentAverage?.value || 0;
      overallCount++;
    });
    const overallAverage = overallCount > 0 ? overallTotal / overallCount : 0;

    return {
      studentOverall: { value: overallAverage, outOf: 20 },
      classAverage: { value: 0 },
      subjects: subjects,
      createdByAccount: this.accountId,
    };
  }
}
