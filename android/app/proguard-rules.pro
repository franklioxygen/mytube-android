# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# ─── React Native core ────────────────────────────────────────────────────────
# React Native already ships its own consumer rules, but we duplicate the
# critical bits here to keep the release APK working if those drift.
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.proguard.annotations.DoNotStrip
-keep @com.facebook.proguard.annotations.DoNotStrip class * { *; }
-keepclassmembers class * {
    @com.facebook.proguard.annotations.DoNotStrip *;
}

# ─── New Architecture (TurboModules / Fabric) ────────────────────────────────
-keep class com.facebook.react.turbomodule.** { *; }
-keep class com.facebook.react.fabric.** { *; }

# ─── react-native-video (ExoPlayer) ──────────────────────────────────────────
-keep class com.brentvatne.** { *; }
-keep class com.google.android.exoplayer2.** { *; }
-dontwarn com.google.android.exoplayer2.**

# ─── react-native-mmkv ───────────────────────────────────────────────────────
-keep class com.tencent.mmkv.** { *; }
-keep class com.mrousavy.mmkv.** { *; }

# ─── react-native-nitro-modules ──────────────────────────────────────────────
-keep class com.margelo.nitro.** { *; }

# ─── react-native-screens ────────────────────────────────────────────────────
-keep class com.swmansion.rnscreens.** { *; }

# ─── react-native-safe-area-context ──────────────────────────────────────────
-keep class com.th3rdwave.safeareacontext.** { *; }

# ─── react-native-vector-icons ───────────────────────────────────────────────
-keep class com.oblador.vectoricons.** { *; }

# ─── Kotlin metadata (used by reflection in some RN libs) ────────────────────
-keep class kotlin.Metadata { *; }
-keepattributes Signature, InnerClasses, EnclosingMethod, *Annotation*
