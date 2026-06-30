import { mockPrograms, Template } from '../data/mockData';

export interface NextWorkoutSelection {
  name: string;
  exercises: string[];
  exercisesDetails?: any[];
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
      
      const dayNameToIndex = new Map<string, number>();
      programDayNames.forEach((name, i) => {
        if (!dayNameToIndex.has(name)) dayNameToIndex.set(name, i);
      });
      
      let lastMatchingDayIndex = -1;
      for (let i = 0; i < sessions.length; i++) {
        const titleClean = sessions[i].title.toLowerCase().trim();
        const matchIdx = dayNameToIndex.get(titleClean);
        if (matchIdx !== undefined && matchIdx > -1) {
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
    
    // If we didn't match the last session to a template directly, try to find the template with the most recent lastUsed timestamp
    if (!matchedTemplate && sessions && sessions.length > 0) {
      let newestTemplate: Template | null = null;
      let newestTime = 0;
      templates.forEach(t => {
        if (t.lastUsed) {
          const time = new Date(t.lastUsed).getTime();
          if (time > newestTime) {
            newestTime = time;
            newestTemplate = t;
          }
        }
      });
      matchedTemplate = newestTemplate;
    }

    let candidateTemplates = [...templates];
    if (matchedTemplate && matchedTemplate.folder) {
      const folderTemplates = templates.filter(t => t.folder === matchedTemplate?.folder);
      if (folderTemplates.length > 0) {
        candidateTemplates = folderTemplates;
      }
    }
    
    let selectedTemplate = candidateTemplates[0];
    if (matchedTemplate) {
      const idx = candidateTemplates.findIndex(t => t.id === matchedTemplate?.id);
      if (idx !== -1) {
        selectedTemplate = candidateTemplates[(idx + 1) % candidateTemplates.length];
      }
    }
    
    return {
      name: selectedTemplate.name,
      exercises: selectedTemplate.exercises,
      exercisesDetails: selectedTemplate.exercisesDetails,
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
