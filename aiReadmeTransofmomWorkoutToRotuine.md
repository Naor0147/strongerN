# Guide: Convert Workout Screenshot to JSON Import Payload for strongerN

You can copy and paste this entire markdown document as a **prompt** into any AI (Claude, Gemini, ChatGPT, etc.) alongside the screenshots of your routine. The AI will output a clean JSON that you can copy and import directly into the app.

---

## Copy & Paste Prompt for the AI:

```markdown
You are an expert data extraction assistant for fitness applications.
I am uploading one or more screenshot images of a workout routine from another workout app.

Please analyze the screenshots and extract the routine details to generate a JSON payload compatible with my workout app's import format.

### Target JSON Structure:
Generate a single JSON object. Do not include any default values or fields for which there is no data in the screenshots. Make the JSON as compact as possible.

Fields to extract:
- `name`: (string) The name of the routine (e.g., "Push Day", "Upper A").
- `folder`: (string, optional) A category folder to file it under. Omit if not seen.
- `notes`: (string, optional) Any general workout/routine notes, targets, or instructions. Omit if not seen.
- `exercises`: (array of strings) The list of all exercise names in order.
- `exercisesDetails`: (array of objects, optional) The detailed structure for each exercise. Omit if not seen.

Each object in `exercisesDetails` can have:
- `name`: (string) The exercise name.
- `notes`: (string, optional) Exercise-specific notes, execution tips, seat settings, or target cues. Omit if not seen.
- `superSetGroupId`: (string, optional) If this exercise is part of a superset (linked with other exercises), specify a matching group identifier (e.g., "ss-1"). Omit if not seen.
- `sets`: (array of objects) Detailed sets representing how many sets there are and their order.

Each set in the `sets` array can have:
- `category`: (string, optional) One of these characters depending on the type of set shown in the screenshot:
  - "S" : Standard set (normal)
  - "W" : Warmup set
  - "D" : Drop set
  - "F" : Failure set
  Omit if it is a standard set and no special indicator is seen.
- `isUnilateral`: (boolean, optional) Set to true only if the exercise is unilateral (performed separately on Left and Right sides, e.g., Dumbbell Bicep Curl, Bulgarian Split Squat, Single Leg Extension). Omit if false.

*Crucial Design Rule:* DO NOT extract or save "weight" or "reps" (no weight, reps, leftWeight, leftReps, rightWeight, or rightReps) for any set. Just save the set order, count (the length of the array), category, and whether it is unilateral.

### Rules for Extraction:
1. Match exercise names to common terms (e.g., if you see "Incline DB Press", translate it to "Incline Dumbbell Bench Press").
2. Only include optional properties if they are explicitly present in the screenshot. If there is no general note or exercise-specific note, do not include the "notes" field.
3. Strictly output ONLY the final JSON block. Do not write explanation text before or after the JSON block.

Here are the screenshots:
```

---

## Example of Compact Output JSON to Expect:

```json
{
  "name": "Push Day A",
  "folder": "Hypertrophy",
  "notes": "Focus on controlled eccentrics.",
  "exercises": [
    "Incline Dumbbell Bench Press",
    "Flat Barbell Bench Press",
    "Cable Lateral Raise"
  ],
  "exercisesDetails": [
    {
      "name": "Incline Dumbbell Bench Press",
      "notes": "Seat angle at 30 degrees",
      "sets": [
        { "category": "W" },
        { "category": "S" },
        { "category": "S" }
      ]
    },
    {
      "name": "Flat Barbell Bench Press",
      "sets": [
        {},
        { "category": "D" }
      ]
    },
    {
      "name": "Cable Lateral Raise",
      "sets": [
        { "isUnilateral": true }
      ]
    }
  ]
}
```
