import { mockPrograms, Template } from '../data/mockData';

export interface NextWorkoutSelection {
  name: string;
  exercises: string[];
  type: 'Active Program' | 'Routine Split' | 'Quick Start';
  badgeColor: string;
}

export const getNextWorkout = (
  activeProgramId: string | null,
  sessions: any[],
  templates: Template[],
  colors: { accent: string; violet: string; highlight: string }
): NextWorkoutSelection => {
  // 1. If user is on an active program
  if (activeProgramId) {
    const activeProgram = mockPrograms.find(p => p.id === activeProgramId);
    if (activeProgram && activeProgram.days && activeProgram.days.length > 0) {
      const programDayNames = activeProgram.days.map(d => d.workoutName.toLowerCase().trim());
      
      let lastMatchingDayIndex = -1;
      for (let i = 0; i < sessions.length; i++) {
        const titleClean = sessions[i].title.toLowerCase().trim();
        const matchIdx = programDayNames.findIndex(name => name === titleClean);
        if (matchIdx > -1) {
          lastMatchingDayIndex = matchIdx;
          break;
        }
      }
      
      const nextDayIndex = (lastMatchingDayIndex + 1) % activeProgram.days.length;
      const nextDay = activeProgram.days[nextDayIndex];
      
      return {
        name: nextDay.workoutName,
        exercises: nextDay.exercises,
        type: 'Active Program',
        badgeColor: colors.accent,
      };
    }
  }

  // 2. If no active program, check templates
  if (templates && templates.length > 0) {
    const lastSession = sessions && sessions.length > 0 ? sessions[0] : null;
    let matchedTemplate: Template | null = null;
    
    if (lastSession) {
      const sessionTitleClean = lastSession.title.toLowerCase().trim();
      matchedTemplate = templates.find(t => t.name.toLowerCase().trim() === sessionTitleClean) || null;
      
      if (!matchedTemplate) {
        matchedTemplate = templates.find(t => {
          const tNameClean = t.name.toLowerCase().trim();
          const w1 = sessionTitleClean.split(/\s+/);
          const w2 = tNameClean.split(/\s+/);
          const intersection = w1.filter((w: string) => w2.includes(w) && w.length > 2);
          return intersection.length >= 2 || sessionTitleClean.includes(tNameClean) || tNameClean.includes(sessionTitleClean);
        }) || null;
      }
    }
    
    let candidateTemplates = [...templates];
    if (matchedTemplate && matchedTemplate.folder) {
      const folderTemplates = templates.filter(t => t.folder === matchedTemplate?.folder);
      if (folderTemplates.length > 0) {
        candidateTemplates = folderTemplates;
      }
    }
    
    candidateTemplates.sort((a, b) => {
      const timeA = a.lastUsed ? new Date(a.lastUsed).getTime() : 0;
      const timeB = b.lastUsed ? new Date(b.lastUsed).getTime() : 0;
      if (timeA !== timeB) {
        return timeA - timeB;
      }
      return a.name.localeCompare(b.name);
    });
    
    const selectedTemplate = candidateTemplates[0];
    return {
      name: selectedTemplate.name,
      exercises: selectedTemplate.exercises,
      type: 'Routine Split',
      badgeColor: colors.highlight,
    };
  }

  // 3. Fallback if no templates/program
  return {
    name: 'Empty Workout',
    exercises: [],
    type: 'Quick Start',
    badgeColor: colors.highlight,
  };
};

export function isUnilateralExercise(name: string): boolean {
  if (!name) return false;
  const n = name.toLowerCase();
  return (
    n.includes('single-arm') ||
    n.includes('single-leg') ||
    n.includes('one-arm') ||
    n.includes('one-leg') ||
    n.includes('unilateral') ||
    n.includes('concentration') ||
    n.includes('pistol') ||
    n.includes('bulgarian') ||
    n.includes('lunges') ||
    n.includes('lunge') ||
    n.includes('step-up') ||
    n.includes('stepup')
  );
}
