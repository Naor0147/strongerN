

### 🚀 Epic 1: Core Workout & Exercise Features

* **Super Sets Implementation:** Add the ability to create super sets within a workout plan, ensuring a seamless user selection flow.
* **Enhanced Exercise Details:** Expand the exercise info view to include primary muscles worked, secondary muscles, historical PRs, and progression charts.
* **Exercise Notes:** Add a 3-dot context menu to individual exercises to allow users to add and save custom notes.
* **Interactive Muscle Map:** * Create an animation where the selected muscle enlarges and turns red upon clicking.
* Display a list of exercises performed targeting that muscle for the current week.
* Provide a list of suggested exercises the user can choose from for that specific muscle.



### 🎨 Epic 2: UI/UX & Smooth Animations

* **Global Animation Polish:** Implement very smooth, fluid animations across the entire application to give it a premium feel.
* **Swipe-to-Delete:** Add gesture controls allowing users to slide left on a set or an exercise to remove it instantly.
* **Empty Workout Flow:** Add a conditional animation/prompt to the "Finish" button; if the user attempts to finish a workout with zero logged sets, prompt them to discard the workout instead.
* **Responsive Design Audit:** Do a full pass to ensure all screens look visually appealing and scale correctly across different device sizes.

### 📊 Epic 3: Profile, Navigation & Data Tracking

* **Profile Dashboard Redesign:** * Remove the old icon/div (`<div dir="auto"...></div>`).
* Migrate measurements, PRs, charts, and overall stats out of the Settings menu and into a dedicated, clickable Profile dashboard.
* Keep standard account management (like changing the user's name) strictly in the Settings menu.


* **Calendar Navigation:** Update the calendar component so users can easily navigate between different months and years.

### 🛠️ Epic 4: Refactoring, Testing & Stability

* **Volume Tracking Logic:** Fix the set-tracking logic to ensure the amount of sets logged perfectly corresponds to the data shown on the Muscle Map.
* **Discard Workout Fix:** Debug and resolve the issue where the "Discard Workout" button/functionality is not working.
* **Comprehensive Testing System:** Build out a robust testing system to check all edge cases, preventing app crashes during unexpected user flows. Ensure the codebase remains modular during these fixes.

### 📦 Epic 5: Release Preparation

* **App Store & Play Store Readiness:** Conduct final compliance checks, update store listings, and ensure all assets and policies are ready for official submission to Apple and Google.

---
