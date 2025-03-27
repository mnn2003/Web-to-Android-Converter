import React, { useState } from 'react';
import { Smartphone, Globe, Bell, Music, Upload, CheckCircle, AlertCircle } from 'lucide-react';

interface AppConfig {
  websiteUrl: string;
  appName: string;
  icon: File | null;
  enableNotifications: boolean;
  enableMusicControls: boolean;
}

interface ApiResponse {
  success: boolean;
  downloadUrl?: string;
  appName?: string;
  error?: string;
}

function App() {
  const [config, setConfig] = useState<AppConfig>({
    websiteUrl: '',
    appName: '',
    icon: null,
    enableNotifications: false,
    enableMusicControls: false,
  });
  const [previewIcon, setPreviewIcon] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiResponse, setApiResponse] = useState<ApiResponse | null>(null);

  const handleIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setConfig({ ...config, icon: file });
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewIcon(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setApiResponse(null);

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-android-app`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          websiteUrl: config.websiteUrl,
          appName: config.appName,
          icon: previewIcon,
          enableNotifications: config.enableNotifications,
          enableMusicControls: config.enableMusicControls,
        }),
      });

      const result = await response.json();
      setApiResponse(result);

      // Reset form on success
      if (result.success) {
        setTimeout(() => {
          setConfig({
            websiteUrl: '',
            appName: '',
            icon: null,
            enableNotifications: false,
            enableMusicControls: false,
          });
          setPreviewIcon('');
          setApiResponse(null);
        }, 5000);
      }
    } catch (error) {
      setApiResponse({
        success: false,
        error: 'Failed to connect to the server. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="px-8 py-6">
          <div className="flex items-center justify-center mb-6">
            <Smartphone className="h-8 w-8 text-indigo-600" />
            <h1 className="ml-3 text-2xl font-bold text-gray-900">Web to Android Converter</h1>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                <div className="flex items-center mb-1">
                  <Globe className="h-4 w-4 mr-1" />
                  Website URL
                </div>
              </label>
              <input
                type="url"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="https://your-website.com"
                value={config.websiteUrl}
                onChange={(e) => setConfig({ ...config, websiteUrl: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                App Name
              </label>
              <input
                type="text"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="My Android App"
                value={config.appName}
                onChange={(e) => setConfig({ ...config, appName: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                <div className="flex items-center mb-1">
                  <Upload className="h-4 w-4 mr-1" />
                  App Icon
                </div>
              </label>
              <div className="mt-1 flex items-center space-x-4">
                <input
                  type="file"
                  accept="image/*"
                  required
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                  onChange={handleIconChange}
                />
                {previewIcon && (
                  <img src={previewIcon} alt="Icon preview" className="h-12 w-12 object-cover rounded" />
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  checked={config.enableNotifications}
                  onChange={(e) => setConfig({ ...config, enableNotifications: e.target.checked })}
                />
                <label className="ml-2 block text-sm text-gray-700 flex items-center">
                  <Bell className="h-4 w-4 mr-1" />
                  Enable Notifications
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  checked={config.enableMusicControls}
                  onChange={(e) => setConfig({ ...config, enableMusicControls: e.target.checked })}
                />
                <label className="ml-2 block text-sm text-gray-700 flex items-center">
                  <Music className="h-4 w-4 mr-1" />
                  Enable Music Controls
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                isSubmitting ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'
              } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
            >
              {isSubmitting ? 'Converting...' : 'Convert to Android App'}
            </button>
          </form>

          {apiResponse && (
            <div className={`mt-4 p-4 ${apiResponse.success ? 'bg-green-50' : 'bg-red-50'} rounded-md flex items-center`}>
              {apiResponse.success ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <div className="text-sm text-green-700">
                    <p className="font-medium">Success! Your Android app is ready.</p>
                    <a 
                      href={apiResponse.downloadUrl}
                      className="inline-block mt-2 text-green-600 hover:text-green-800 underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Download {apiResponse.appName}
                    </a>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                  <p className="text-sm text-red-700">
                    {apiResponse.error || 'An error occurred. Please try again.'}
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;