import { createClient } from 'npm:@supabase/supabase-js@2.39.7';
import JSZip from 'npm:jszip@3.10.1';
import { Buffer } from 'node:buffer';
import { join } from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface AppConfig {
  websiteUrl: string;
  appName: string;
  icon: string;
  enableNotifications: boolean;
  enableMusicControls: boolean;
}

const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  {
    auth: {
      persistSession: false,
    }
  }
);

async function generateAndroidApp(config: AppConfig) {
  try {
    console.log('Starting Android app generation');
    const appId = `${Date.now()}-${config.appName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    const packageName = `com.webview.${config.appName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    
    // Create a new ZIP file
    const zip = new JSZip();

    // Create the proper APK directory structure
    const mainDir = zip.folder("app");
    const srcDir = mainDir?.folder("src");
    const mainDir2 = srcDir?.folder("main");
    const javaDir = mainDir2?.folder("java");
    const resDir = mainDir2?.folder("res");
    const layoutDir = resDir?.folder("layout");
    const valuesDir = resDir?.folder("values");
    const mipmapDir = resDir?.folder("mipmap-xxxhdpi");
    const xmlDir = resDir?.folder("xml");

    // Add AndroidManifest.xml
    const manifestContent = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="${packageName}">

    <uses-permission android:name="android.permission.INTERNET" />
    ${config.enableNotifications ? '<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />' : ''}
    ${config.enableMusicControls ? '<uses-permission android:name="android.permission.MEDIA_CONTENT_CONTROL" />' : ''}

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:supportsRtl="true"
        android:theme="@style/Theme.AppCompat.Light.NoActionBar"
        android:usesCleartextTraffic="true">
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>`;

    mainDir2?.file("AndroidManifest.xml", manifestContent);

    // Add network security config
    const networkSecurityConfig = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system" />
            <certificates src="user" />
        </trust-anchors>
    </base-config>
</network-security-config>`;
    
    xmlDir?.file("network_security_config.xml", networkSecurityConfig);

    // Add MainActivity.java
    const packagePath = packageName.split('.').join('/');
    const javaPackageDir = javaDir?.folder(packagePath);
    
    const mainActivityContent = `package ${packageName};

import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebSettings;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        
        webView = findViewById(R.id.webview);
        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setLoadWithOverviewMode(true);
        webSettings.setUseWideViewPort(true);
        webSettings.setBuiltInZoomControls(true);
        webSettings.setDisplayZoomControls(false);
        webSettings.setSupportZoom(true);
        webSettings.setDefaultTextEncodingName("utf-8");
        
        webView.setWebViewClient(new WebViewClient());
        webView.loadUrl("${config.websiteUrl}");
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}`;

    javaPackageDir?.file("MainActivity.java", mainActivityContent);

    // Add layout
    const activityMainLayout = `<?xml version="1.0" encoding="utf-8"?>
<RelativeLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent">

    <WebView
        android:id="@+id/webview"
        android:layout_width="match_parent"
        android:layout_height="match_parent" />

</RelativeLayout>`;

    layoutDir?.file("activity_main.xml", activityMainLayout);

    // Add strings.xml
    const stringsContent = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">${config.appName}</string>
</resources>`;

    valuesDir?.file("strings.xml", stringsContent);

    // Add styles.xml
    const stylesContent = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="Theme.AppCompat.Light.NoActionBar">
        <item name="colorPrimary">#2196F3</item>
        <item name="colorPrimaryDark">#1976D2</item>
        <item name="colorAccent">#FF4081</item>
    </style>
</resources>`;

    valuesDir?.file("styles.xml", stylesContent);

    // Process and add the icon
    if (config.icon && config.icon.startsWith('data:image')) {
      const iconData = Buffer.from(config.icon.split(',')[1], 'base64');
      mipmapDir?.file("ic_launcher.png", iconData);
    }

    // Add build.gradle
    const buildGradleContent = `plugins {
    id 'com.android.application'
}

android {
    namespace '${packageName}'
    compileSdk 33

    defaultConfig {
        applicationId "${packageName}"
        minSdk 21
        targetSdk 33
        versionCode 1
        versionName "1.0"
    }

    buildTypes {
        release {
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_1_8
        targetCompatibility JavaVersion.VERSION_1_8
    }
}

dependencies {
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'androidx.webkit:webkit:1.7.0'
}`;

    mainDir?.file("build.gradle", buildGradleContent);

    // Add settings.gradle
    const settingsGradleContent = `rootProject.name = "${config.appName}"
include ':app'`;

    zip.file("settings.gradle", settingsGradleContent);

    // Add gradle-wrapper.properties
    const gradleWrapperContent = `distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\\://services.gradle.org/distributions/gradle-8.0-bin.zip
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists`;

    const gradleDir = zip.folder("gradle/wrapper");
    gradleDir?.file("gradle-wrapper.properties", gradleWrapperContent);

    // Generate the APK content
    console.log('Generating APK file...');
    const apkContent = await zip.generateAsync({
      type: "uint8array",
      compression: "DEFLATE",
      compressionOptions: {
        level: 9
      }
    });

    console.log('APK content generated, size:', apkContent.length);

    // Ensure the android-apps bucket exists
    const { data: buckets } = await supabaseClient.storage.listBuckets();
    const androidAppsBucket = buckets?.find(b => b.name === 'android-apps');
    
    if (!androidAppsBucket) {
      console.log('Creating android-apps bucket');
      const { error: createBucketError } = await supabaseClient
        .storage
        .createBucket('android-apps', { public: true });

      if (createBucketError) {
        throw new Error(`Failed to create storage bucket: ${createBucketError.message}`);
      }
    }

    // Upload the APK with retry mechanism
    let uploadError;
    let uploadData;
    
    for (let i = 0; i < 3; i++) {
      try {
        console.log(`Upload attempt ${i + 1}`);
        const result = await supabaseClient
          .storage
          .from('android-apps')
          .upload(`${appId}/app-debug.apk`, apkContent, {
            contentType: 'application/vnd.android.package-archive',
            duplex: 'half',
            upsert: true
          });

        uploadData = result.data;
        uploadError = result.error;

        if (!uploadError) {
          console.log('Upload successful');
          break;
        }

        console.error(`Upload attempt ${i + 1} failed:`, uploadError);
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      } catch (error) {
        console.error(`Unexpected error on upload attempt ${i + 1}:`, error);
        uploadError = error;
      }
    }

    if (uploadError) {
      throw new Error(`Failed to upload APK: ${uploadError.message || 'Unknown error'}`);
    }

    // Get the download URL
    const { data: { publicUrl } } = supabaseClient
      .storage
      .from('android-apps')
      .getPublicUrl(`${appId}/app-debug.apk`);

    console.log('APK uploaded successfully, public URL:', publicUrl);

    return {
      success: true,
      downloadUrl: publicUrl,
      appName: config.appName,
      packageName: packageName
    };
  } catch (error) {
    console.error('Error in generateAndroidApp:', error);
    throw error;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method === 'POST') {
      const config: AppConfig = await req.json();
      console.log('Received request with config:', {
        websiteUrl: config.websiteUrl,
        appName: config.appName,
        enableNotifications: config.enableNotifications,
        enableMusicControls: config.enableMusicControls
      });

      if (!config.websiteUrl || !config.appName || !config.icon) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields' }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          }
        );
      }

      const result = await generateAndroidApp(config);

      return new Response(
        JSON.stringify(result),
        {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );
  } catch (error) {
    console.error('Error in request handler:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );
  }
});
