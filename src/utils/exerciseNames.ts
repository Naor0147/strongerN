/**
 * Bilingual Exercise Name Registry
 * Maps exercise English names to Hebrew translations and search aliases.
 * Aliases include gym slang, colloquialisms, and alternative spellings.
 */

interface ExerciseNameEntry {
  nameHe: string;
  searchAliases: string[];
}

const exerciseNameMap: Record<string, ExerciseNameEntry> = {
  'Ab Wheel': {
    nameHe: 'גלגל בטן',
    searchAliases: ['גלגל', 'ab wheel', 'בטן גלגל'],
  },
  'Ab Wheel Rollout': {
    nameHe: 'גלגול גלגל בטן',
    searchAliases: ['גלגל rollout', 'גלגול בטן'],
  },
  'Arnold Press': {
    nameHe: 'לחיצת ארנולד',
    searchAliases: ['ארנולד', 'arnold', 'לחיצת ארנולד'],
  },
  'Assisted Sissy Squat': {
    nameHe: 'סקוואט סיסי עם עזרה',
    searchAliases: ['סיסי סקוואט', 'sissy squat'],
  },
  'Back Extension': {
    nameHe: 'פשיטת גב',
    searchAliases: ['הארכת גב', 'back ext', 'גב תחתון'],
  },
  'Back Squat': {
    nameHe: 'סקוואט אחורי',
    searchAliases: ['סקוואט', 'squat', 'סקוואט עם מוט', 'סקוואט גב'],
  },
  'Band Chest Fly': {
    nameHe: 'פרפר חזה עם גומייה',
    searchAliases: ['פרפר גומייה', 'band fly', 'חזה גומייה'],
  },
  'Band Chest Press': {
    nameHe: 'לחיצת חזה עם גומייה',
    searchAliases: ['לחיצת גומייה', 'band press'],
  },
  'Band Underhand Lat Pulldown': {
    nameHe: 'משיכת לט תחתונה עם גומייה',
    searchAliases: ['לט גומייה'],
  },
  'Barbell Bicep Curl': {
    nameHe: 'כיפוף ביצפס עם מוט',
    searchAliases: ['בייספס מוט', 'curl מוט', 'כיפוף מוט'],
  },
  'Barbell Hip Thrust': {
    nameHe: 'הרמת אגן עם מוט',
    searchAliases: ['היפ תראסט מוט', 'hip thrust מוט'],
  },
  'Barbell Overhead Press': {
    nameHe: 'לחיצת כתף מעל הראש עם מוט',
    searchAliases: ['OHP מוט', 'לחיצת כתף מוט', 'overhead press'],
  },
  'Barbell Preacher Curl': {
    nameHe: 'כיפוף פריצ\'ר עם מוט',
    searchAliases: ['פריצר מוט', 'preacher curl'],
  },
  'Barbell Reverse Curl': {
    nameHe: 'כיפוף הפוך עם מוט',
    searchAliases: ['reverse curl מוט'],
  },
  'Barbell Romanian Deadlift': {
    nameHe: 'דדליפט רומני עם מוט',
    searchAliases: ['RDL מוט', 'רומני מוט', 'דדליפט רומני'],
  },
  'Barbell Row': {
    nameHe: 'חתירת מוט',
    searchAliases: ['barbell row', 'ברו מוט', 'חתירה עם מוט'],
  },
  'Barbell Shrugs': {
    nameHe: 'משיכת כתפיים עם מוט',
    searchAliases: ['שרגס מוט', 'shrugs'],
  },
  'Barbell Skullcrusher': {
    nameHe: 'מכת גולגולת עם מוט',
    searchAliases: ['סקולקראשר מוט', 'skullcrusher'],
  },
  'Barbell Stiff Leg Deadlift': {
    nameHe: 'דדליפט רגליים ישרות עם מוט',
    searchAliases: ['stiff leg deadlift', 'דדליפט ישר'],
  },
  'Barbell Triceps Extension': {
    nameHe: 'הארכת טריצפס עם מוט',
    searchAliases: ['טריצפס מוט', 'triceps ext מוט'],
  },
  'Barbell Upright Row': {
    nameHe: 'חתירה אנכית עם מוט',
    searchAliases: ['upright row', 'חתירה זקופה'],
  },
  'Barbell Wrist Curl': {
    nameHe: 'כיפוף שורש כף יד עם מוט',
    searchAliases: ['wrist curl מוט', 'שורש כף יד'],
  },
  'Bayesian Cable Curl': {
    nameHe: 'כיפוף כבל בייסיאני',
    searchAliases: ['בייסיאני', 'bayesian'],
  },
  'Behind The Back Bicep Curl': {
    nameHe: 'כיפוף ביצפס מאחורי הגב',
    searchAliases: ['מאחורי הגב curl'],
  },
  'Behind-the-back Curl': {
    nameHe: 'כיפוף מאחורי הגב',
    searchAliases: ['curl מאחורי הגב'],
  },
  'Bench Press': {
    nameHe: 'לחיצת חזה',
    searchAliases: ['בנץ', 'bench', 'חזה', 'לחיצת ספסל', 'בנץ\' פרס'],
  },
  'Bent Over Barbell Rear Delt Raise': {
    nameHe: 'הרמת דלט אחורית עם מוט כפוף',
    searchAliases: ['rear delt מוט', 'דלט אחורית'],
  },
  'Bicep Curl': {
    nameHe: 'כיפוף ביצפס',
    searchAliases: ['בייספס', 'bicep', 'curl', 'כיפוף זרוע'],
  },
  'Boxing': {
    nameHe: 'איגרוף',
    searchAliases: ['boxing', 'אגרוף'],
  },
  'Bulgarian Split Squat': {
    nameHe: 'סקוואט בולגרי',
    searchAliases: ['בולגרי', 'bulgarian', 'split squat בולגרי'],
  },
  'Cable Bicep Curl': {
    nameHe: 'כיפוף ביצפס בכבל',
    searchAliases: ['בייספס כבל', 'cable curl'],
  },
  'Cable Crossover': {
    nameHe: 'הצלבת כבלים',
    searchAliases: ['crossover', 'הצלבה'],
  },
  'Cable Crunch': {
    nameHe: 'כפיפת בטן בכבל',
    searchAliases: ['crunch כבל', 'בטן כבל'],
  },
  'Cable Face Pull': {
    nameHe: 'משיכת פנים בכבל',
    searchAliases: ['face pull', 'facepull'],
  },
  'Cable Fly': {
    nameHe: 'פרפר כבלים',
    searchAliases: ['cable fly', 'פרפר כבל', 'fly'],
  },
  'Cable Lat Pulldown': {
    nameHe: 'משיכת לט בכבל',
    searchAliases: ['lat pulldown כבל'],
  },
  'Cable Lateral Raise': {
    nameHe: 'הרמה צדית בכבל',
    searchAliases: ['לטרל רייז כבל', 'lateral raise כבל'],
  },
  'Cable Leg Sidekick': {
    nameHe: 'בעיטת צד בכבל',
    searchAliases: ['sidekick כבל'],
  },
  'Cable Pushdown': {
    nameHe: 'דחיפת כבל למטה',
    searchAliases: ['pushdown', 'טריצפס pushdown'],
  },
  'Cable Reverse Curl': {
    nameHe: 'כיפוף הפוך בכבל',
    searchAliases: ['reverse curl כבל'],
  },
  'Cable Reverse Fly': {
    nameHe: 'פרפר הפוך בכבל',
    searchAliases: ['reverse fly כבל'],
  },
  'Cable Seated Row': {
    nameHe: 'חתירת כבל בישיבה',
    searchAliases: ['seated row כבל', 'חתירה ישיבה'],
  },
  'Cable Triceps Extension': {
    nameHe: 'הארכת טריצפס בכבל',
    searchAliases: ['טריצפס כבל'],
  },
  'Cable Triceps Pushdown': {
    nameHe: 'דחיפת טריצפס בכבל',
    searchAliases: ['triceps pushdown'],
  },
  'Calf Press On Leg Press': {
    nameHe: 'לחיצת שוק בלחיצת רגליים',
    searchAliases: ['שוק leg press'],
  },
  'Calf Press On Seated Leg Press': {
    nameHe: 'לחיצת שוק בישיבה',
    searchAliases: ['שוק ישיבה'],
  },
  'Calf Raises': {
    nameHe: 'הרמת שוק',
    searchAliases: ['שוק', 'calves', 'calf raise', 'הרמת עקב'],
  },
  'Chest Dip': {
    nameHe: 'שכיבת סמיכה לחזה',
    searchAliases: ['dips חזה', 'dip חזה'],
  },
  'Chest Fly': {
    nameHe: 'פרפר חזה',
    searchAliases: ['fly חזה', 'פרפר'],
  },
  'Chest Press': {
    nameHe: 'לחיצת חזה',
    searchAliases: ['חזה מכונה', 'chest press'],
  },
  'Chin-Up': {
    nameHe: 'מתח',
    searchAliases: ['chin up', 'chinup', 'מתח'],
  },
  'Chin-ups': {
    nameHe: 'מתח',
    searchAliases: ['chin ups', 'chinups', 'מתח'],
  },
  'Close-grip Bench Press': {
    nameHe: 'לחיצת חזה באחיזה צרה',
    searchAliases: ['בנץ אחיזה צרה', 'close grip bench'],
  },
  'Close-grip LAT Pulldown': {
    nameHe: 'משיכת לט באחיזה צרה',
    searchAliases: ['lat close grip'],
  },
  'Concentration Curl': {
    nameHe: 'כיפוף ריכוז',
    searchAliases: ['concentration curl', 'כיפוף מרוכז'],
  },
  'Cross Body Cable Triceps Extension': {
    nameHe: 'הארכת טריצפס חוצה גוף בכבל',
    searchAliases: ['cross body triceps'],
  },
  'Deadlift': {
    nameHe: 'דדליפט',
    searchAliases: ['deadlift', 'dl', 'דד ליפט', 'הרמה'],
  },
  'Decline Ab Crunch': {
    nameHe: 'כפיפת בטן בירידה',
    searchAliases: ['crunch ירידה'],
  },
  'Decline Bench Press': {
    nameHe: 'לחיצת חזה בירידה',
    searchAliases: ['בנץ ירידה', 'decline bench'],
  },
  'Decline Push-Up': {
    nameHe: 'שכיבת סמיכה בירידה',
    searchAliases: ['סמיכה ירידה'],
  },
  'Deficit Barbell Row': {
    nameHe: 'חתירת מוט עם גירעון',
    searchAliases: ['deficit row'],
  },
  'Deficit Underhand Barbell Row': {
    nameHe: 'חתירת מוט תחתונה עם גירעון',
    searchAliases: ['deficit underhand row'],
  },
  'Diamond Push-ups': {
    nameHe: 'שכיבות סמיכה יהלום',
    searchAliases: ['יהלום', 'diamond pushup', 'סמיכה יהלום'],
  },
  'Dips': {
    nameHe: 'דיפס',
    searchAliases: ['dips', 'דיפים', 'שכיבות סמיכה מקבילים'],
  },
  'Dumbbell Bench Press': {
    nameHe: 'לחיצת חזה עם משקולות',
    searchAliases: ['בנץ דאמבל', 'dumbbell bench'],
  },
  'Dumbbell Bicep Curl': {
    nameHe: 'כיפוף ביצפס עם משקולות',
    searchAliases: ['בייספס דאמבל', 'dumbbell curl'],
  },
  'Dumbbell Hammer Curl': {
    nameHe: 'כיפוף פטיש עם משקולות',
    searchAliases: ['האמר קורל', 'hammer curl דאמבל'],
  },
  'Dumbbell Lateral Raise': {
    nameHe: 'הרמה צדית עם משקולות',
    searchAliases: ['לטרל רייז דאמבל', 'lateral raise דאמבל'],
  },
  'Dumbbell Lunge': {
    nameHe: 'לאנג\' עם משקולות',
    searchAliases: ['לאנג דאמבל', 'lunge דאמבל'],
  },
  'Dumbbell Press': {
    nameHe: 'לחיצת משקולות',
    searchAliases: ['דאמבל פרס', 'dumbbell press'],
  },
  'Dumbbell Pullover': {
    nameHe: 'פולאובר עם משקולות',
    searchAliases: ['פולאובר דאמבל', 'pullover'],
  },
  'Dumbbell Romanian Deadlift': {
    nameHe: 'דדליפט רומני עם משקולות',
    searchAliases: ['RDL דאמבל', 'רומני דאמבל'],
  },
  'Dumbbell Row': {
    nameHe: 'חתירת משקולות',
    searchAliases: ['דאמבל רו', 'dumbbell row', 'חתירה דאמבל'],
  },
  'Dumbbell Shoulder Press': {
    nameHe: 'לחיצת כתף עם משקולות',
    searchAliases: ['כתף דאמבל', 'shoulder press דאמבל'],
  },
  'Dumbbell Shrug': {
    nameHe: 'משיכת כתפיים עם משקולות',
    searchAliases: ['שרגס דאמבל'],
  },
  'Dumbbell Skullcrusher': {
    nameHe: 'מכת גולגולת עם משקולות',
    searchAliases: ['סקולקראשר דאמבל'],
  },
  'Dumbbell Wrist Curl': {
    nameHe: 'כיפוף שורש כף יד עם משקולות',
    searchAliases: ['wrist curl דאמבל'],
  },
  'Egyptian Lateral Raise': {
    nameHe: 'הרמה צדית מצרית',
    searchAliases: ['מצרית', 'egyptian lateral'],
  },
  'EZ Bar Curl': {
    nameHe: 'כיפוף מוט EZ',
    searchAliases: ['EZ bar', 'איזי בר', 'כיפוף איזי'],
  },
  'Face Pull': {
    nameHe: 'משיכת פנים',
    searchAliases: ['face pull', 'facepull', 'פייס פול'],
  },
  'Farmer Walk With Fat Grip': {
    nameHe: 'הליכת חקלאי עם אחיזה עבה',
    searchAliases: ['farmer walk', 'חקלאי'],
  },
  'Front Squat': {
    nameHe: 'סקוואט קדמי',
    searchAliases: ['front squat', 'סקוואט פרונט'],
  },
  'Glute Hyperextension': {
    nameHe: 'היפר-אקסטנשן ישבן',
    searchAliases: ['גלוט היפר'],
  },
  'Glute Kickback': {
    nameHe: 'בעיטת ישבן',
    searchAliases: ['kickback', 'גלוט קיקבק'],
  },
  'Goblet Squat': {
    nameHe: 'סקוואט גביע',
    searchAliases: ['goblet squat', 'גביע'],
  },
  'Hack Squat': {
    nameHe: 'האק סקוואט',
    searchAliases: ['hack squat', 'האק'],
  },
  'Hammer Curl': {
    nameHe: 'כיפוף פטיש',
    searchAliases: ['hammer curl', 'האמר', 'פטיש'],
  },
  'Hammer Strength Row': {
    nameHe: 'חתירת האמר סטרנג\'',
    searchAliases: ['hammer strength', 'האמר רו'],
  },
  'Hanging Leg Raise': {
    nameHe: 'הרמת רגליים תלוי',
    searchAliases: ['hanging leg raise', 'הרמת רגליים'],
  },
  'High Chest Fly For Lower Chest': {
    nameHe: 'פרפר חזה גבוה לחזה תחתון',
    searchAliases: ['פרפר גבוה תחתון'],
  },
  'High To Low Chest Fly': {
    nameHe: 'פרפר חזה מלמעלה למטה',
    searchAliases: ['high to low fly'],
  },
  'Hip Abductor': {
    nameHe: 'מרחיק ירך',
    searchAliases: ['abductor', 'הפרד ירך'],
  },
  'Hip Adductor': {
    nameHe: 'מקריב ירך',
    searchAliases: ['adductor', 'הוסף ירך'],
  },
  'Hip Thrust': {
    nameHe: 'הרמת אגן',
    searchAliases: ['hip thrust', 'היפ תראסט', 'תראסט'],
  },
  'Hyperextensions': {
    nameHe: 'היפר-אקסטנשן',
    searchAliases: ['hyperextension', 'hyperext', 'הארכת גב'],
  },
  'Incline Barbell Bench Press': {
    nameHe: 'לחיצת חזה עליונה עם מוט',
    searchAliases: ['אינקליין בנץ מוט'],
  },
  'Incline Bench Press': {
    nameHe: 'לחיצת חזה עליונה',
    searchAliases: ['אינקליין', 'incline bench', 'אינקליין בנץ', 'חזה עליון'],
  },
  'Incline Bicep Curl': {
    nameHe: 'כיפוף ביצפס עליון',
    searchAliases: ['אינקליין curl'],
  },
  'Incline Chest Press': {
    nameHe: 'לחיצת חזה עליונה במכונה',
    searchAliases: ['אינקליין פרס מכונה'],
  },
  'Incline Dumbbell Bench Press': {
    nameHe: 'לחיצת חזה עליונה עם משקולות',
    searchAliases: ['אינקליין דאמבל בנץ'],
  },
  'Incline Dumbbell Curl': {
    nameHe: 'כיפוף משקולות עליון',
    searchAliases: ['אינקליין דאמבל curl'],
  },
  'Incline Dumbbell Fly': {
    nameHe: 'פרפר משקולות עליון',
    searchAliases: ['אינקליין דאמבל fly'],
  },
  'Incline Dumbbell Row': {
    nameHe: 'חתירת משקולות עליונה',
    searchAliases: ['אינקליין דאמבל רו'],
  },
  'Incline Shrug': {
    nameHe: 'משיכת כתפיים עליונה',
    searchAliases: ['אינקליין שרגס'],
  },
  'Iso-Lateral Row': {
    nameHe: 'חתירה איזו-לטרלית',
    searchAliases: ['iso lateral', 'איזו לטרלי'],
  },
  'Jpg Lat Pulldown': {
    nameHe: 'משיכת לט JPG',
    searchAliases: ['jpg lat'],
  },
  'Jpg Triceps Pushdown': {
    nameHe: 'דחיפת טריצפס JPG',
    searchAliases: ['jpg triceps'],
  },
  'LAT Pulldown': {
    nameHe: 'משיכת לט',
    searchAliases: ['lat pulldown', 'לט', 'lat pd', 'משיכת גב'],
  },
  'LAT Pulldown Cable 2 Balls': {
    nameHe: 'משיכת לט עם 2 כדורים',
    searchAliases: ['lat 2 balls'],
  },
  'LAT Pulldown Close Grip': {
    nameHe: 'משיכת לט אחיזה צרה',
    searchAliases: ['lat close grip'],
  },
  'Lat-Focused Cable Row': {
    nameHe: 'חתירת כבל ממוקדת גב',
    searchAliases: ['lat cable row'],
  },
  'Lateral Raise': {
    nameHe: 'הרמה צדית',
    searchAliases: ['lateral raise', 'לטרל רייז', 'הרמה צדית'],
  },
  'Leg Curl': {
    nameHe: 'כיפוף רגליים',
    searchAliases: ['leg curl', 'המסטרינגס curl'],
  },
  'Leg Extension': {
    nameHe: 'הארכת רגליים',
    searchAliases: ['leg extension', 'קוואדריצפס extension'],
  },
  'Leg Press': {
    nameHe: 'לחיצת רגליים',
    searchAliases: ['leg press', 'לג פרס'],
  },
  'Low Cable Chest Fly': {
    nameHe: 'פרפר חזה כבל נמוך',
    searchAliases: ['low cable fly'],
  },
  'Low To High Chest Fly': {
    nameHe: 'פרפר חזה מלמטה למעלה',
    searchAliases: ['low to high fly'],
  },
  'Lying Incline Bench Dumbbell Row Traps Focus': {
    nameHe: 'חתירת משקולות שכיבה עליונה טרפז',
    searchAliases: ['lying incline row traps'],
  },
  'Lying Leg Curl': {
    nameHe: 'כיפוף רגליים שכיבה',
    searchAliases: ['lying leg curl', 'שכיבה leg curl'],
  },
  'Machine Lateral Raise': {
    nameHe: 'הרמה צדית במכונה',
    searchAliases: ['לטרל מכונה', 'machine lateral'],
  },
  'Machine Pullover': {
    nameHe: 'פולאובר במכונה',
    searchAliases: ['machine pullover'],
  },
  'Machine Reverse Curl': {
    nameHe: 'כיפוף הפוך במכונה',
    searchAliases: ['machine reverse curl'],
  },
  'Machine Seated Row': {
    nameHe: 'חתירת מכונה בישיבה',
    searchAliases: ['machine seated row', 'חתירה מכונה'],
  },
  'Machine Wrist Curl': {
    nameHe: 'כיפוף שורש כף יד במכונה',
    searchAliases: ['machine wrist curl'],
  },
  'Middle Cable Chest Fly With Bench': {
    nameHe: 'פרפר חזה כבל אמצעי עם ספסל',
    searchAliases: ['middle cable fly'],
  },
  'Nordic Curl': {
    nameHe: 'כיפוף נורדי',
    searchAliases: ['nordic curl', 'נורדי'],
  },
  'Overhead Press': {
    nameHe: 'לחיצת כתף מעל הראש',
    searchAliases: ['overhead press', 'OHP', 'אוברהד', 'לחיצת כתף'],
  },
  'Overhead Tricep Ext': {
    nameHe: 'הארכת טריצפס מעל הראש',
    searchAliases: ['overhead triceps', 'טריצפס מעל הראש'],
  },
  'Pec Dec Fly': {
    nameHe: 'פרפר פק דק',
    searchAliases: ['pec dec', 'פק דק'],
  },
  'Pec Deck Fly': {
    nameHe: 'פרפר דק חזה',
    searchAliases: ['pec deck'],
  },
  'Pin-Loaded Chest Press': {
    nameHe: 'לחיצת חזה עם פינים',
    searchAliases: ['pin loaded chest press'],
  },
  'Plank': {
    nameHe: 'פלאנק',
    searchAliases: ['plank', 'פלאנק', 'קרש'],
  },
  'Plate-Loaded Chest Press': {
    nameHe: 'לחיצת חזה עם צלחות',
    searchAliases: ['plate loaded chest press'],
  },
  'Plate-Loaded Lat Pulldown': {
    nameHe: 'משיכת לט עם צלחות',
    searchAliases: ['plate loaded lat'],
  },
  'Plate-Loaded Leg Extension': {
    nameHe: 'הארכת רגליים עם צלחות',
    searchAliases: ['plate loaded leg ext'],
  },
  'Preacher Curl': {
    nameHe: 'כיפוף פריצ\'ר',
    searchAliases: ['preacher curl', 'פריצר'],
  },
  'Pull-Up': {
    nameHe: 'מתח',
    searchAliases: ['pull up', 'pullup', 'מתח'],
  },
  'Pull-ups': {
    nameHe: 'מתח',
    searchAliases: ['pull ups', 'pullups', 'מתח'],
  },
  'Push-ups': {
    nameHe: 'שכיבות סמיכה',
    searchAliases: ['push ups', 'pushups', 'סמיכה', 'שכיבת סמיכה'],
  },
  'Rear Delt Fly': {
    nameHe: 'פרפר דלט אחורי',
    searchAliases: ['rear delt fly', 'דלט אחורית', 'rear delt'],
  },
  'Rear Delt Fly Machine': {
    nameHe: 'פרפר דלט אחורי במכונה',
    searchAliases: ['rear delt machine'],
  },
  'Reverse Barbell Curl': {
    nameHe: 'כיפוף הפוך עם מוט',
    searchAliases: ['reverse curl מוט'],
  },
  'Reverse Grip Concentration Curl': {
    nameHe: 'כיפוף ריכוז באחיזה הפוכה',
    searchAliases: ['reverse grip concentration'],
  },
  'Reverse Nordic Curl': {
    nameHe: 'כיפוף נורדי הפוך',
    searchAliases: ['reverse nordic'],
  },
  'Reverse Pec Dec Fly': {
    nameHe: 'פרפר פק דק הפוך',
    searchAliases: ['reverse pec dec'],
  },
  'Reverse Seated Wrist Curl': {
    nameHe: 'כיפוף שורש כף יד הפוך בישיבה',
    searchAliases: ['reverse seated wrist'],
  },
  'Reverse Wrist Curl': {
    nameHe: 'כיפוף שורש כף יד הפוך',
    searchAliases: ['reverse wrist curl'],
  },
  'Romanian Deadlift': {
    nameHe: 'דדליפט רומני',
    searchAliases: ['romanian deadlift', 'RDL', 'רומני', 'דדליפט ר'],
  },
  'Russian Twist': {
    nameHe: 'טוויסט רוסי',
    searchAliases: ['russian twist', 'רוסי טוויסט'],
  },
  'Seated Bent Over Dumbbell Row': {
    nameHe: 'חתירת משקולות כפופה בישיבה',
    searchAliases: ['seated bent over row'],
  },
  'Seated Bicep Curl': {
    nameHe: 'כיפוף ביצפס בישיבה',
    searchAliases: ['seated curl'],
  },
  'Seated Calf Raise': {
    nameHe: 'הרמת שוק בישיבה',
    searchAliases: ['seated calf raise', 'שוק ישיבה'],
  },
  'Seated Dumbbell Lateral Raise': {
    nameHe: 'הרמה צדית עם משקולות בישיבה',
    searchAliases: ['seated lateral raise'],
  },
  'Seated Dumbbell Lateral Raise Partials': {
    nameHe: 'הרמה צדית חלקית בישיבה',
    searchAliases: ['seated lateral partials'],
  },
  'Seated Dumbbell Overhead Press': {
    nameHe: 'לחיצת כתף עם משקולות בישיבה',
    searchAliases: ['seated dumbbell OHP'],
  },
  'Seated Dumbbell Wrist Curl': {
    nameHe: 'כיפוף שורש כף יד עם משקולות בישיבה',
    searchAliases: ['seated dumbbell wrist'],
  },
  'Seated Leg Curl': {
    nameHe: 'כיפוף רגליים בישיבה',
    searchAliases: ['seated leg curl'],
  },
  'Seated Leg Press': {
    nameHe: 'לחיצת רגליים בישיבה',
    searchAliases: ['seated leg press'],
  },
  'Seated Row': {
    nameHe: 'חתירה בישיבה',
    searchAliases: ['seated row', 'חתירה ישיבה'],
  },
  'Seated Shoulder Press': {
    nameHe: 'לחיצת כתף בישיבה',
    searchAliases: ['seated shoulder press'],
  },
  'Seated Shrug': {
    nameHe: 'משיכת כתפיים בישיבה',
    searchAliases: ['seated shrug'],
  },
  'Shoulder Press': {
    nameHe: 'לחיצת כתף',
    searchAliases: ['shoulder press', 'כתף', 'כתפיים press'],
  },
  'Single Arm Cable Triceps Extension': {
    nameHe: 'הארכת טריצפס יד אחת בכבל',
    searchAliases: ['single arm triceps cable'],
  },
  'Single Arm Dumbbell Row': {
    nameHe: 'חתירת משקולות יד אחת',
    searchAliases: ['single arm row', 'חתירה יד אחת'],
  },
  'Single Arm Dumbbell Triceps Extension': {
    nameHe: 'הארכת טריצפס יד אחת עם משקולות',
    searchAliases: ['single arm triceps dumbbell'],
  },
  'Single Arm Front Raise': {
    nameHe: 'הרמת חזית יד אחת',
    searchAliases: ['single arm front raise'],
  },
  'Single Arm Lat Pulldown': {
    nameHe: 'משיכת לט יד אחת',
    searchAliases: ['single arm lat'],
  },
  'Single Arm Shoulder Press': {
    nameHe: 'לחיצת כתף יד אחת',
    searchAliases: ['single arm shoulder press'],
  },
  'Single Arm Wrist Curl': {
    nameHe: 'כיפוף שורש כף יד יד אחת',
    searchAliases: ['single arm wrist'],
  },
  'Single Leg Calf Press On Seated Leg Press': {
    nameHe: 'לחיצת שוק רגל אחת בישיבה',
    searchAliases: ['single leg calf seated'],
  },
  'Single Leg Lunge On Chair': {
    nameHe: 'לאנג\' רגל אחת על כיסא',
    searchAliases: ['single leg lunge chair'],
  },
  'Sissy Squat On Leg Press': {
    nameHe: 'סקוואט סיסי בלחיצת רגליים',
    searchAliases: ['sissy squat leg press'],
  },
  'Skull Crushers': {
    nameHe: 'מכת גולגולת',
    searchAliases: ['skull crushers', 'סקולקראשר', 'גולגולת'],
  },
  'Smith Machine Incline Bench Press': {
    nameHe: 'לחיצת חזה עליונה במכונת סמית\'',
    searchAliases: ['סמית אינקליין', 'smith incline'],
  },
  'Smith Machine Sissy Squat': {
    nameHe: 'סקוואט סיסי במכונת סמית\'',
    searchAliases: ['סמית סיסי'],
  },
  'Smith Machine Squat': {
    nameHe: 'סקוואט במכונת סמית\'',
    searchAliases: ['סמית סקוואט', 'smith squat'],
  },
  'Smith Machine Standing Calf Raise': {
    nameHe: 'הרמת שוק בעמידה במכונת סמית\'',
    searchAliases: ['סמית שוק'],
  },
  'Squat': {
    nameHe: 'סקוואט',
    searchAliases: ['squat', 'סקוואט', 'כריעה'],
  },
  'Standing Calf Raise': {
    nameHe: 'הרמת שוק בעמידה',
    searchAliases: ['standing calf raise', 'שוק עמידה'],
  },
  'Sumo Deadlift': {
    nameHe: 'דדליפט סומו',
    searchAliases: ['sumo deadlift', 'סומו', 'דדליפט סומו'],
  },
  'T-bar Row': {
    nameHe: 'חתירת T-בר',
    searchAliases: ['t-bar row', 't bar row', 'טי בר'],
  },
  'T-Bar Row': {
    nameHe: 'חתירת T-בר',
    searchAliases: ['t-bar row', 't bar row', 'טי בר'],
  },
  'T-Bar Shrug': {
    nameHe: 'משיכת כתפיים T-בר',
    searchAliases: ['t-bar shrug'],
  },
  'Thoracic Extension': {
    nameHe: 'הארכת חזה',
    searchAliases: ['thoracic extension', 'חזה הארכה'],
  },
  'Towel Bicep Curl': {
    nameHe: 'כיפוף ביצפס עם מגבת',
    searchAliases: ['towel curl', 'מגבת curl'],
  },
  'Trap Bar Shrug': {
    nameHe: 'משיכת כתפיים עם מוט מלכודת',
    searchAliases: ['trap bar shrug', 'trap bar'],
  },
  'Tricep Dips': {
    nameHe: 'דיפס טריצפס',
    searchAliases: ['tricep dips', 'טריצפס dips'],
  },
  'Triceps Extension': {
    nameHe: 'הארכת טריצפס',
    searchAliases: ['triceps extension', 'טריצפס'],
  },
  'Triceps Overhead Extension': {
    nameHe: 'הארכת טריצפס מעל הראש',
    searchAliases: ['overhead triceps extension'],
  },
  'Underhand Barbell Row': {
    nameHe: 'חתירת מוט תחתונה',
    searchAliases: ['underhand barbell row'],
  },
  'Warm-Up': {
    nameHe: 'חימום',
    searchAliases: ['warm up', 'warmup', 'חימום'],
  },
  'Weighted Single Leg Glute Bridge': {
    nameHe: 'גשר ישבן רגל אחת עם משקל',
    searchAliases: ['weighted glute bridge'],
  },
  'Wide Grip Pull-Up': {
    nameHe: 'מתח אחיזה רחבה',
    searchAliases: ['wide grip pull up', 'מתח רחב'],
  },
  'Wrist Curl': {
    nameHe: 'כיפוף שורש כף יד',
    searchAliases: ['wrist curl', 'שורש כף יד'],
  },
  'Wrist Roller': {
    nameHe: 'גולגל שורש כף יד',
    searchAliases: ['wrist roller', 'roller שורש'],
  },
};

/**
 * Get the Hebrew name for an exercise by its English name.
 * Falls back to the English name if no translation exists.
 */
function getExerciseNameHe(englishName: string): string {
  if (!englishName || typeof englishName !== 'string') return '';
  return exerciseNameMap[englishName]?.nameHe ?? englishName;
}

/**
 * Get search aliases for an exercise by its English name.
 */
function getExerciseAliases(englishName: string): string[] {
  if (!englishName || typeof englishName !== 'string') return [];
  return exerciseNameMap[englishName]?.searchAliases ?? [];
}

/**
 * Get the display name for an exercise based on the current language preference.
 */
export function getDisplayName(englishName: string, lang: 'en' | 'he'): string {
  if (!englishName || typeof englishName !== 'string') return '';
  if (lang === 'he') {
    return getExerciseNameHe(englishName);
  }
  return englishName;
}

/**
 * Cross-lingual search filter.
 * Matches query against English name, Hebrew name, and all aliases.
 * Returns true if the exercise matches the query.
 */
export function exerciseMatchesQuery(englishName: string, query: string): boolean {
  if (!englishName || typeof englishName !== 'string') return false;
  if (!query.trim()) return true;
  const q = query.toLowerCase().trim();

  // Check English name
  if (englishName.toLowerCase().includes(q)) return true;

  // Check Hebrew name
  const heName = getExerciseNameHe(englishName);
  if (heName.includes(query.trim())) return true;

  // Check aliases
  const aliases = getExerciseAliases(englishName);
  for (const alias of aliases) {
    if (alias.toLowerCase().includes(q)) return true;
  }

  return false;
}

/**
 * Muscle Group Name Translations
 * Maps English muscle group identifiers to Hebrew display names.
 * Keys are the internal identifiers used in SVG maps and data matching.
 */
const muscleNameMap: Record<string, string> = {
  'Chest': 'חזה',
  'Back': 'גב',
  'Quads': 'ארבע ראשי',
  'Hamstrings': 'ירך אחורית',
  'Shoulders': 'כתפיים',
  'Biceps': 'ביצפס',
  'Triceps': 'טריצפס',
  'Glutes': 'עכוז',
  'Rear Delts': 'דלתא אחורית',
  'Calves': 'שוקיים',
  'Abs': 'בטן',
  'Forearms': 'אמות',
  'Core': 'ליבה',
};

/**
 * Get the Hebrew display name for a muscle group.
 */
function getMuscleNameHe(englishName: string): string {
  return muscleNameMap[englishName] ?? englishName;
}

/**
 * Get the display name for a muscle group based on the current language preference.
 */
export function getMuscleDisplayName(englishName: string, lang: 'en' | 'he'): string {
  if (lang === 'he') {
    return getMuscleNameHe(englishName);
  }
  return englishName;
}

