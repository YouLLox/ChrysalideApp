import { useAccountStore } from "@/stores/account";

import { cleanSubjectName } from "./utils";

/**
 * Registers a subject with a persistent color if not already set.
 * Should be called when syllabus is first loaded.
 */
export function registerSubjectColor(subject: string): string {
  const cleanedName = cleanSubjectName(subject);
  const lastUsedAccount = useAccountStore.getState().lastUsedAccount;
  const existingColor = useAccountStore
    .getState()
    .accounts.find(a => a.id === lastUsedAccount)?.customisation?.subjects?.[
    cleanedName
  ]?.color;

  // If already has a color, return it
  if (existingColor && existingColor !== "") {
    return existingColor;
  }

  // Get already used colors to avoid duplicates
  const subjects = useAccountStore
    .getState()
    .accounts.find(a => a.id === lastUsedAccount)?.customisation?.subjects;
  const usedColors = Object.values(subjects ?? {})
    .map(item => item.color)
    .filter(Boolean);

  // Pick a color and persist it
  const newColor = getRandomColor(usedColors);
  useAccountStore.getState().setSubjectColor(cleanedName, newColor);

  return newColor;
}

export function getSubjectColor(subject: string): string {
  const cleanedName = cleanSubjectName(subject);
  const lastUsedAccount = useAccountStore.getState().lastUsedAccount;
  const subjectProperties = useAccountStore
    .getState()
    .accounts.find(a => a.id === lastUsedAccount)?.customisation?.subjects?.[
    cleanedName
  ];

  // If subject has a color, return it
  if (subjectProperties?.color && subjectProperties.color !== "") {
    return subjectProperties.color;
  }

  // Fallback: return first color (don't generate random without persisting)
  return Colors[0];
}

export function getRandomColor(ignoredColors?: string[]): string {
  if (
    ignoredColors &&
    ignoredColors.length > 0 &&
    ignoredColors.length < Colors.length
  ) {
    const availableColors = Colors.filter(
      color => !ignoredColors.includes(color)
    );
    if (availableColors.length > 0) {
      return availableColors[
        Math.floor(Math.random() * availableColors.length)
      ];
    }
  }
  // Always return a valid color from the array
  return Colors[Math.floor(Math.random() * Colors.length)];
}

export const Colors = [
  "#C50017",
  "#DA2400",
  "#DD6B00",
  "#E8901C",
  "#E8B048",
  "#6BAE00",
  "#37BB12",
  "#12BB67",
  "#26B290",
  "#26ABB2",
  "#2DB9D8",
  "#009EC5",
  "#007FDA",
  "#3A56D0",
  "#7600CA",
  "#962DD8",
  "#B300CA",
  "#C50066",
  "#DD004A",
  "#DD0030",
];
