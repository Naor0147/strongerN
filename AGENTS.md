# Auto-Load Agent Rules

At the start of every session, read the `.agents` folder and load all rule files from `.agents/rules/` to understand project-specific behaviors and constraints.

# Graphify Auto-Update

After modifying any code files in a session, always run `graphify update .` to keep the knowledge graph current.

# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# DO NOT CHANGE SIGNING KEYSTORE / SIGNATURE

When building, compiling, or deploying the app, always use the developer's personal keystore from `C:\Users\NAORA\.android\debug.keystore`. Do not replace it, commit a default repository keystore, or perform any uninstallation/signature changes that would break in-place updates on the connected device.

# Standalone APK Auto-Build

After completing any task or making modifications, always rebuild the standalone release APK by running:
`cmd.exe /c "(echo y & echo 2 & echo 4) | build-apk.bat"`
This compiles the release app and deploys it automatically to any connected USB debugging device.

