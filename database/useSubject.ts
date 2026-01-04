import { Model, Q } from "@nozbe/watermelondb";

import { Subject as SharedSubject } from "@/services/shared/grade";
import { generateId } from "@/utils/generateId";
import { info } from "@/utils/logger/logger";

import { getDatabaseInstance } from "./DatabaseProvider";
import Subject from "./models/Subject";
import { safeWrite } from "./utils/safeTransaction";

export async function addSubjectsToDatabase(
  subjects: SharedSubject[],
  periodGradeId?: string
) {
  const db = getDatabaseInstance();

  const subjectsToCreate: Array<{
    id: string;
    item: SharedSubject;
  }> = [];

  for (const item of subjects) {
    const id = generateId(item.name);
    const existingForAccount = await db
      .get("subjects")
      .query(Q.where("subjectId", id))
      .fetch();

    if (existingForAccount.length === 0) {
      subjectsToCreate.push({ id, item });
    }
  }

  if (subjectsToCreate.length > 0) {
    await safeWrite(
      db,
      async () => {
        const promises = subjectsToCreate.map(({ id, item }) =>
          db.get("subjects").create((record: Model) => {
            const subject = record as Subject;
            // Assign to the TypeScript property names (matching @field decorators)
            subject.subjectId = id;
            subject.name = item.name;
            subject.studentAverageRaw = JSON.stringify(item.studentAverage);
            subject.classAverageRaw = JSON.stringify(item.classAverage);
            subject.maximumRaw = JSON.stringify(item.maximum);
            subject.minimumRaw = JSON.stringify(item.minimum);
            subject.outOfRaw = JSON.stringify(item.outOf);
            subject.periodGradeId = periodGradeId;
          })
        );
        await Promise.all(promises);
      },
      10000,
      `add_subjects_${subjectsToCreate.length}_items`
    );
  } else {
    info(`🍉 No new subjects to add (all ${subjects.length} already exist)`);
  }
}
