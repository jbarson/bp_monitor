'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ReadingForm, ReadingSession } from '@/components/readings/ReadingForm';
import ReadingDisplay from '@/components/readings/ReadingDisplay';
import AuthForm from '@/components/auth/AuthForm';
import { getCurrentUser } from '@/lib/auth';
import type { UserSession } from '@/lib/auth';

export default function Home() {
  const [user, setUser] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<ReadingSession>({
    date: new Date(),
    complete: false,
    readings: []
  });

  const router = useRouter();

  // Load user on initial render
  useEffect(() => {
    async function loadUser() {
      try {
        setIsLoading(true);
        const currentUser = await getCurrentUser();
        setUser(currentUser);
        
        // If user is not authenticated, the middleware will handle redirection
      } catch (error) {
        setError('Failed to load user information. Please try refreshing the page.');
        console.error('Error loading user:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadUser();
  }, []);

  // Handle session complete
  const handleSessionComplete = (completedSession: ReadingSession) => {
    setSession(completedSession);
    // You could add additional actions here like notifications
    // or automatically navigating to another page
  };

  // Handle user authentication
  const handleAuthSuccess = (authenticatedUser: { id: string; name: string; email: string }) => {
    setUser({
      userId: authenticatedUser.id,
      name: authenticatedUser.name,
      email: authenticatedUser.email,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto my-8 p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <h2 className="text-xl font-semibold text-red-800 dark:text-red-400 mb-2">Error</h2>
        <p className="text-red-700 dark:text-red-300">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Refresh Page
        </button>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto my-8">
        <h1 className="text-2xl font-bold text-center mb-6 text-gray-800 dark:text-white">
          Welcome to BP Monitor
        </h1>
        <p className="text-center mb-8 text-gray-600 dark:text-gray-300">
          Please sign in to track your blood pressure readings
        </p>
        <AuthForm onAuthSuccess={handleAuthSuccess} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Welcome section */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
          Welcome, {user.name}
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Track your blood pressure readings below. Remember to take 3 readings for each session for the most accurate results.
        </p>
      </div>

      {/* Blood pressure reading form */}
      <ReadingForm 
        onSessionComplete={handleSessionComplete}
        initialSession={session}
      />

      {/* Display current session readings if any */}
      {session.readings.length > 0 && (
        <ReadingDisplay session={session} />
      )}

      {/* Tips and information */}
      <div className="mt-10 p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <h2 className="text-lg font-semibold text-blue-800 dark:text-blue-400 mb-3">
          Tips for Accurate Readings
        </h2>
        <ul className="list-disc pl-5 text-blue-700 dark:text-blue-300 space-y-2">
          <li>Rest for 5 minutes before taking a reading</li>
          <li>Sit with your back straight and supported</li>
          <li>Keep your feet flat on the floor, don't cross your legs</li>
          <li>Support your arm on a flat surface, with the upper arm at heart level</li>
          <li>Take readings at the same time each day when possible</li>
          <li>Don't take caffeine or exercise within 30 minutes of measurement</li>
        </ul>
      </div>
    </div>
  );
}
