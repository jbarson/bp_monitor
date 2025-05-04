'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthForm from '@/components/auth/AuthForm';
import { getCurrentUser } from '@/lib/auth';
import type { UserSession } from '@/lib/auth';

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<UserSession | null>(null);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect') || '/';

  // Check if user is already logged in
  useEffect(() => {
    async function checkAuth() {
      try {
        setIsLoading(true);
        const currentUser = await getCurrentUser();
        setUser(currentUser);
        
        // If user is already authenticated, redirect to dashboard or requested page
        if (currentUser) {
          router.push(redirectPath);
        }
      } catch (error) {
        console.error('Error checking authentication:', error);
        setError('Failed to check authentication status. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }

    checkAuth();
  }, [redirectPath, router]);

  // Handle successful authentication
  const handleAuthSuccess = (authenticatedUser: { id: string; name: string; email: string }) => {
    // Set a small delay to show success message before redirecting
    setTimeout(() => {
      router.push(redirectPath);
    }, 1000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Checking authentication status...</p>
        </div>
      </div>
    );
  }

  // If user is already authenticated, we'll redirect in the useEffect
  // This will briefly show the loading state
  if (user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600 dark:text-gray-400">You're already logged in. Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Welcome to BP Monitor
        </h1>
        <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
          Track and monitor your blood pressure readings over time. 
          Use passkeys for secure, passwordless authentication.
        </p>
      </div>

      {error && (
        <div className="max-w-md mx-auto mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="max-w-md mx-auto">
        <AuthForm 
          onAuthSuccess={handleAuthSuccess} 
          initialMode={searchParams.get('register') === 'true' ? 'register' : 'login'}
        />
      </div>

      <div className="mt-12 max-w-2xl mx-auto">
        <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">
          About BP Monitor
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-5 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h3 className="text-lg font-medium mb-2 text-gray-700 dark:text-gray-300">
              Track Your Readings
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Record your blood pressure and heart rate with each session requiring 3 readings for accuracy.
              All data is stored securely in your personal database.
            </p>
          </div>
          <div className="p-5 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h3 className="text-lg font-medium mb-2 text-gray-700 dark:text-gray-300">
              Analyze Trends
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Visualize your blood pressure trends over time with interactive charts and 
              statistical analysis to better understand your cardiovascular health.
            </p>
          </div>
          <div className="p-5 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h3 className="text-lg font-medium mb-2 text-gray-700 dark:text-gray-300">
              Secure Authentication
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              BP Monitor uses passkeys (WebAuthn) for secure, passwordless authentication.
              Your biometric data never leaves your device.
            </p>
          </div>
          <div className="p-5 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h3 className="text-lg font-medium mb-2 text-gray-700 dark:text-gray-300">
              Privacy First
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Your health data is private. BP Monitor stores all data in a local database
              that never leaves your control.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

