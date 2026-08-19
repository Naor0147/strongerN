# ─────────────────────────────────────────────────────────────────────────────
# ProGuard / R8 Configuration for StrongerN (Release Optimization)
# ─────────────────────────────────────────────────────────────────────────────

# --- React Native Core & JNI ---
-keep class com.facebook.react.** { *; }
-keep interface com.facebook.react.** { *; }
-keep class com.facebook.react.bridge.JavaScriptModule { *; }
-keep class com.facebook.react.bridge.NativeModule { *; }
-keepclassmembers class * extends com.facebook.react.bridge.NativeModule {
    @com.facebook.react.bridge.ReactMethod *;
}
-keep class com.facebook.react.uimanager.ViewManager { *; }
-keep class com.facebook.react.uimanager.ReactShadowNode { *; }
-keep class com.facebook.react.PackageList { *; }
-keep class com.facebook.react.ReactNativeApplicationEntryPoint { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.soloader.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.yoga.** { *; }

# Preserve native method bindings
-keepclasseswithmembernames class * {
    native <methods>;
}

# --- Expo Modules Architecture & Autolinking ---
-keep class expo.modules.** { *; }
-keep interface expo.modules.** { *; }
-keep @expo.modules.core.interfaces.DoNotStrip class *
-keepclassmembers class * {
    @expo.modules.core.interfaces.DoNotStrip *;
}
-keep class * implements expo.modules.kotlin.records.Record { *; }
-keep class * extends expo.modules.kotlin.sharedobjects.SharedObject { *; }
-keep enum * implements expo.modules.kotlin.types.Enumerable { *; }
-keep class * extends expo.modules.kotlin.modules.Module {
    public <init>();
    public expo.modules.kotlin.modules.ModuleDefinitionData definition();
}
-keepclassmembers class * implements expo.modules.kotlin.views.ExpoView {
    public <init>(android.content.Context);
    public <init>(android.content.Context, expo.modules.kotlin.AppContext);
}

# --- MMKV & Nitro Modules ---
-keep class com.tencent.mmkv.** { *; }
-keep class com.margelo.nitro.** { *; }
-keep interface com.margelo.nitro.** { *; }
-keep class com.margelo.nitro.mmkv.** { *; }

# --- NotifyKit / Notifee ---
-keep class io.invertase.notifee.** { *; }
-keep class app.notifee.core.** { *; }
-keeppackagenames app.notifee.core.**
-keep @interface app.notifee.core.KeepForSdk { *; }
-keep @app.notifee.core.KeepForSdk class * { *; }
-keepclasseswithmembers class * {
    @app.notifee.core.KeepForSdk <fields>;
    @app.notifee.core.KeepForSdk <methods>;
}

# --- Reanimated, Worklets, GestureHandler, Screens, SVG, SafeArea ---
-keep class com.swmansion.reanimated.** { *; }
-keep class com.swmansion.worklets.** { *; }
-keep class com.swmansion.gesturehandler.** { *; }
-keep class com.swmansion.rnscreens.** { *; }
-keep class com.th3rdwave.safeareacontext.** { *; }
-keep class com.horcrux.svg.** { *; }

# --- StrongerN Application Root ---
-keep class com.naor.strongern.** { *; }

# --- General Annotations & Enums ---
-keepattributes *Annotation*,InnerClasses,EnclosingMethod,Signature,Exceptions
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}
