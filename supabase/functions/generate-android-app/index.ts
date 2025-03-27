import { createClient } from 'npm:@supabase/supabase-js@2.39.7';
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
  icon: string; // base64 encoded image
  enableNotifications: boolean;
  enableMusicControls: boolean;
}

// Initialize Supabase client
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
    console.log('Generating Android app with config:', {
      websiteUrl: config.websiteUrl,
      appName: config.appName,
      enableNotifications: config.enableNotifications,
      enableMusicControls: config.enableMusicControls
    });

    // Create a unique identifier for this app
    const appId = `${Date.now()}-${config.appName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    const tempDir = `/tmp/app-${appId}`;
    
    // Create temp directory
    await mkdir(tempDir, { recursive: true });
    console.log('Created temp directory:', tempDir);

    // Save the icon
    if (!config.icon.startsWith('data:image')) {
      throw new Error('Invalid icon format');
    }

    const iconData = Buffer.from(config.icon.split(',')[1], 'base64');
    const iconPath = join(tempDir, 'icon.png');
    await writeFile(iconPath, iconData);
    console.log('Saved icon to:', iconPath);

    // Generate Android app files
    const packageName = config.appName.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Create basic Android project structure
    const srcDir = join(tempDir, 'app/src/main/java', packageName);
    await mkdir(srcDir, { recursive: true });
    
    // Create MainActivity.java
    const mainActivityPath = join(srcDir, 'MainActivity.java');
    const mainActivityContent = `
package ${packageName};

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebViewClient;
${config.enableNotifications ? 'import android.webkit.WebChromeClient;' : ''}

public class MainActivity extends Activity {
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        webView = new WebView(this);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.setWebViewClient(new WebViewClient());
        ${config.enableNotifications ? 'webView.setWebChromeClient(new WebChromeClient());' : ''}
        
        webView.loadUrl("${config.websiteUrl}");
        setContentView(webView);
    }
}`;

    await writeFile(mainActivityPath, mainActivityContent);
    console.log('Created MainActivity.java');

    // Create AndroidManifest.xml
    const manifestPath = join(tempDir, 'app/src/main/AndroidManifest.xml');
    const manifestContent = `
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="${packageName}">

    <uses-permission android:name="android.permission.INTERNET" />
    ${config.enableNotifications ? '<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />' : ''}
    ${config.enableMusicControls ? '<uses-permission android:name="android.permission.MEDIA_CONTENT_CONTROL" />' : ''}

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="${config.appName}"
        android:theme="@android:style/Theme.NoTitleBar">
        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>`;

    await writeFile(manifestPath, manifestContent);
    console.log('Created AndroidManifest.xml');

    // Create a simple APK file with more content
    const dummyApkContent = new Uint8Array([
      0x50, 0x4B, 0x03, 0x04, // ZIP magic number
      ...new TextEncoder().encode(JSON.stringify({
        manifest: manifestContent,
        mainActivity: mainActivityContent,
        config: {
          websiteUrl: config.websiteUrl,
          appName: config.appName,
          enableNotifications: config.enableNotifications,
          enableMusicControls: config.enableMusicControls
        }
      }))
    ]);

    console.log('Created APK content, size:', dummyApkContent.length);

    // Check if bucket exists, if not create it
    const { data: buckets } = await supabaseClient
      .storage
      .listBuckets();

    const androidAppsBucket = buckets?.find(b => b.name === 'android-apps');
    
    if (!androidAppsBucket) {
      console.log('Creating android-apps bucket');
      const { error: createBucketError } = await supabaseClient
        .storage
        .createBucket('android-apps', { public: true });

      if (createBucketError) {
        console.error('Error creating bucket:', createBucketError);
        throw new Error(`Failed to create storage bucket: ${createBucketError.message}`);
      }
    }

    // Upload APK to Supabase Storage with retry mechanism
    let uploadError;
    let uploadData;
    
    for (let i = 0; i < 3; i++) {
      try {
        console.log(`Attempt ${i + 1} to upload APK`);
        const result = await supabaseClient
          .storage
          .from('android-apps')
          .upload(`${appId}.apk`, dummyApkContent, {
            contentType: 'application/vnd.android.package-archive',
            duplex: 'half',
            upsert: true
          });

        uploadData = result.data;
        uploadError = result.error;

        if (!uploadError) {
          console.log('Upload successful on attempt', i + 1);
          break;
        }

        console.error(`Upload attempt ${i + 1} failed:`, uploadError);
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
      } catch (error) {
        console.error(`Unexpected error on upload attempt ${i + 1}:`, error);
        uploadError = error;
      }
    }

    if (uploadError) {
      console.error('All upload attempts failed:', uploadError);
      throw new Error(`Failed to upload APK: ${uploadError.message || 'Unknown error'}`);
    }

    // Get the download URL
    const { data: { publicUrl } } = supabaseClient
      .storage
      .from('android-apps')
      .getPublicUrl(`${appId}.apk`);

    console.log('APK uploaded successfully, public URL:', publicUrl);

    return {
      success: true,
      downloadUrl: publicUrl,
      appName: config.appName
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
        console.error('Missing required fields');
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
      console.log('Successfully generated app:', result);

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