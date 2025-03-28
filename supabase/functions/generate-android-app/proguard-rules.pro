# Keep WebView JavaScript interface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep WebView related classes
-keep class android.webkit.** { *; }
-keep class androidx.webkit.** { *; }

# Keep Activity classes
-keep public class * extends android.app.Activity
-keep public class * extends androidx.appcompat.app.AppCompatActivity

# Keep Application classes
-keep public class * extends android.app.Application

# Keep R classes
-keepclassmembers class **.R$* {
    public static <fields>;
}

# Keep XML resources
-keep class **.R
-keep class **.R$* {
    <fields>;
}

# Keep AndroidManifest
-keep class AndroidManifest.** { *; }

# Keep resources
-keepclassmembers class **.R$* {
    public static <fields>;
}

# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep custom WebViewClient
-keepclassmembers class * extends android.webkit.WebViewClient {
    public void *(android.webkit.WebView, java.lang.String);
}

# Keep WebSettings
-keepclassmembers class * extends android.webkit.WebSettings {
    public *;
}

# Keep all public constructors
-keepclassmembers public class * {
    public <init>(...);
}

# Keep all native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep all classes in certain packages
-keep class androidx.** { *; }
-keep class android.** { *; }

# Keep all Javascript interfaces
-keepattributes JavascriptInterface

# Keep source file names and line numbers
-keepattributes SourceFile,LineNumberTable

# Keep generic signatures
-keepattributes Signature

# Keep Exceptions
-keepattributes Exceptions

# Keep Annotations
-keepattributes *Annotation*
