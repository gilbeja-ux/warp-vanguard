# R8 keep rules for the release build.
#
# READ THIS BEFORE DELETING A LINE. Everything below exists because Capacitor
# wires the JavaScript game to the Java host by REFLECTION and by NAME. R8 can
# only see calls; it cannot see a class looked up from a JSON asset or a method
# invoked from JavaScript. Strip one of these and the build still succeeds, the
# app still installs, and the bridge dies at launch — on the release build only,
# which is the one build a debug run never covers.
#
# Capacitor ships its own consumer rules (they arrive automatically from
# @capacitor/android and keep `* extends com.getcapacitor.Plugin`, so
# HapticsPlugin survives). These are the ones it does NOT ship.

# --- The JS→Java doorway -------------------------------------------------
# The bridge's @JavascriptInterface methods are called from JavaScript by name.
# Nothing in Java calls them, so to R8 they are dead code.
-keepclasseswithmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# --- Annotations the runtime actually reads ------------------------------
# Capacitor's PluginHandle does pluginClass.getAnnotation(CapacitorPlugin.class)
# at startup to learn a plugin's name and permissions. R8 in full mode (the
# default since AGP 8) drops annotations unless told otherwise, and a dropped
# @CapacitorPlugin means the plugin registers under no name at all.
-keepattributes *Annotation*, RuntimeVisibleAnnotations, AnnotationDefault

# --- Readable crash reports ----------------------------------------------
# Obfuscated stack traces are useless in Play Console unless the mapping file
# is there to undo them. AGP uploads mapping.txt with the bundle automatically;
# these two lines are what make the trace worth deobfuscating — keep the line
# numbers, but rename the source file so the class names stay obfuscated.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
