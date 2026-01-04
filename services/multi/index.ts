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
    console.log("getGradesForPeriod called, isAuriga:", this.isAuriga);

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
    const syllabusList = AurigaAPI.getAllSyllabus();

    console.log(
      `Semester ${semesterNum}: ${grades.length} grades, ${syllabusList.length} syllabus items`
    );
    if (grades.length > 0) {
      console.log("Sample grade:", JSON.stringify(grades[0]));
    }
    if (syllabusList.length > 0) {
      console.log(
        "Sample syllabus:",
        JSON.stringify({
          name: syllabusList[0].name,
          exams: syllabusList[0].exams,
        })
      );
    }

    const subjectsMap: Record<string, Subject> = {};

    // For each grade, find matching syllabus and group by syllabus display name
    grades.forEach(g => {
      // Extract UE+subject code from grade name
      // Format: 2526_I_INF_FISE_S03_AG_COM3_EXA_1 -> extract "AG_COM3"
      // Pattern: Remove prefix (YYYY_X_XXX_XXXX_SXX_) and suffix (_EXA_1)
      const gradeNameParts = g.name.split("_");
      // Find the UE code (2 letters) and subject code parts
      // Typically: [year, letter, school, program, semester, UE, SUBJECT, TYPE, NUM]
      // We want UE_SUBJECT (e.g., AG_COM3)
      const ueIndex = gradeNameParts.findIndex(
        part => /^[A-Z]{2}$/.test(part) && gradeNameParts.indexOf(part) >= 5
      );
      const gradeSubjectCode =
        ueIndex >= 0
          ? `${gradeNameParts[ueIndex]}_${gradeNameParts[ueIndex + 1]}`
          : "";

      // Find matching syllabus by checking if both contain the same UE+subject code
      const matchingSyllabus = syllabusList.find(s => {
        const syllabusName = s.name.replace(/\.[^.]+$/, ""); // Remove file extension
        // Check if syllabus contains the same UE_SUBJECT code
        return gradeSubjectCode && syllabusName.includes(gradeSubjectCode);
      });

      // Use syllabus display name if found, otherwise fall back to grade name
      const subjectName =
        matchingSyllabus?.caption?.name ||
        matchingSyllabus?.name?.replace(/\.[^.]+$/, "") || // Remove extension
        g.name;

      // Use the grade's type field directly (e.g., "EXA", "CC", "TP")
      const examType = g.type || "";
      let description = examType || "Note";
      let coefficient = 1; // Default coefficient (100%)

      if (matchingSyllabus) {
        // Extract exam part from name for description
        const syllabusCode = matchingSyllabus.name.replace(/\.[^.]+$/, "");
        const examPart = g.name.replace(syllabusCode + "_", "");
        if (examPart) {
          description = examPart.replace(/_/g, " ");
        }

        // Find matching exam in syllabus by exam type code
        const matchingExam = matchingSyllabus.exams?.find(
          e => e.type === examType
        );
        const availableExamTypes =
          matchingSyllabus.exams?.map(e => e.type).join(", ") || "none";
        console.log(
          `Grade ${gradeSubjectCode} (${g.code}): matched ${subjectName}, type=${examType}, available=[${availableExamTypes}], matched=${!!matchingExam}`
        );

        if (matchingExam && matchingExam.weighting) {
          // Convert percentage to decimal (e.g., 30 -> 0.30)
          coefficient = matchingExam.weighting / 100;
          console.log(
            `  -> Weighting: ${matchingExam.weighting}% -> coefficient: ${coefficient}`
          );
        }

        console.log(
          `Grade ${g.name}: type=${examType}, matched=${!!matchingExam}, coef=${coefficient}`
        );
      } else {
        console.log(`Grade ${g.code}: NO MATCHING SYLLABUS for ${g.name}`);
      }

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
        description: description,
        givenAt: new Date(),
        studentScore: { value: g.grade },
        outOf: { value: 20 },
        coefficient: coefficient,
        createdByAccount: this.accountId,
      };

      subjectsMap[subjectName].grades?.push(gradeItem);
    });

    // Calculate weighted averages per subject
    Object.values(subjectsMap).forEach(s => {
      const sGrades = s.grades || [];
      let totalWeightedScore = 0;
      let totalWeight = 0;

      sGrades.forEach(grade => {
        const score = grade.studentScore?.value || 0;
        const weight = grade.coefficient || 1;
        totalWeightedScore += score * weight;
        totalWeight += weight;
      });

      s.studentAverage = {
        value: totalWeight > 0 ? totalWeightedScore / totalWeight : 0,
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
