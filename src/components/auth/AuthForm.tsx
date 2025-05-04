'use client';

import { useState, FormEvent } from 'react';
import { 
  startRegistration, 
  startAuthentication 
} from '@simplewebauthn/browser';

// Define form modes
type AuthMode = 'login' | 'register';

// Auth form states
type FormState = {
  email: string;
  name: string;
  deviceName: string;
  error: string | null;
  success: string | null;
  isLoading: boolean;
};

// Props for the AuthForm component
interface AuthFormProps {
  onAuthSuccess?: (user: { id: string; name: string; email: string }) => void;
  initialMode?: AuthMode;
}

export default function AuthForm({ 
  onAuthSuccess, 
  initialMode = 'login' 
}: AuthFormProps) {
  // State for toggling between login and register
  const [mode, setMode] = useState<AuthMode>(initialMode);
  
  // Form state management
  const [formState, setFormState] = useState<FormState>({
    email: '',
    name: '',
    deviceName: '',
    error: null,
    success: null,
    isLoading: false
  });

  const { email, name, deviceName, error, success, isLoading } = formState;

  // Helper to update form state
  const updateForm = (updates: Partial<FormState>) => {
    setFormState(prev => ({ ...prev, ...updates }));
  };

  // Reset form errors and success messages
  const resetMessages = () => {
    updateForm({ error: null, success: null });
  };

  // Toggle between login and register modes
  const toggleMode = () => {
    resetMessages();
    setMode(mode === 'login' ? 'register' : 'login');
  };

  // Handle login flow
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    resetMessages();
    
    if (!email) {
      updateForm({ error: 'Email is required' });
      return;
    }

    try {
      updateForm({ isLoading: true });

      // 1. Get authentication options from server
      const optionsResponse = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const optionsData = await optionsResponse.json();

      if (!optionsResponse.ok) {
        throw new Error(optionsData.error || 'Could not start authentication');
      }

      // 2. Start authentication with the browser API
      const assertionResponse = await startAuthentication(optionsData.options);

      // 3. Verify the assertion with the server
      const verificationResponse = await fetch('/api/auth/login', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assertionResponse }),
      });

      const verificationData = await verificationResponse.json();

      if (!verificationResponse.ok) {
        throw new Error(verificationData.error || 'Authentication failed');
      }

      // 4. Authentication successful
      updateForm({
        success: 'Authentication successful! Redirecting...',
        isLoading: false
      });

      // Call the success callback if provided
      if (onAuthSuccess && verificationData.user) {
        onAuthSuccess(verificationData.user);
      }
    } catch (err) {
      updateForm({
        error: err instanceof Error ? err.message : 'Authentication failed',
        isLoading: false
      });
    }
  };

  // Handle registration flow
  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    resetMessages();
    
    if (!email || !name) {
      updateForm({ error: 'Email and name are required' });
      return;
    }

    try {
      updateForm({ isLoading: true });

      // 1. Get registration options from server
      const optionsResponse = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name }),
      });

      const optionsData = await optionsResponse.json();

      if (!optionsResponse.ok) {
        throw new Error(optionsData.error || 'Could not start registration');
      }

      // 2. Start registration with the browser API
      const attestationResponse = await startRegistration(optionsData.options);

      // 3. Verify the attestation with the server
      const verificationResponse = await fetch('/api/auth/register', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email, 
          attestationResponse,
          deviceName: deviceName || 'My Device' 
        }),
      });

      const verificationData = await verificationResponse.json();

      if (!verificationResponse.ok) {
        throw new Error(verificationData.error || 'Registration failed');
      }

      // 4. Registration successful, switch to login
      updateForm({
        success: 'Passkey registered successfully! You can now login.',
        isLoading: false
      });

      // Clear form fields after successful registration
      setTimeout(() => {
        setMode('login');
        updateForm({
          name: '',
          deviceName: '',
          success: null
        });
      }, 2000);

    } catch (err) {
      updateForm({
        error: err instanceof Error ? err.message : 'Registration failed',
        isLoading: false
      });
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-white rounded-lg shadow-md dark:bg-gray-800">
      <h2 className="text-2xl font-bold mb-6 text-center text-gray-800 dark:text-white">
        {mode === 'login' ? 'Sign In with Passkey' : 'Create Account with Passkey'}
      </h2>

      {/* Error message */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* Success message */}
      {success && (
        <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
          {success}
        </div>
      )}

      <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="space-y-4">
        {/* Email field */}
        <div>
          <label 
            htmlFor="email" 
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => updateForm({ email: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            placeholder="Enter your email"
            required
          />
        </div>

        {/* Name field (only for registration) */}
        {mode === 'register' && (
          <div>
            <label 
              htmlFor="name" 
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Full Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => updateForm({ name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="Enter your full name"
              required
            />
          </div>
        )}

        {/* Device name (only for registration) */}
        {mode === 'register' && (
          <div>
            <label 
              htmlFor="deviceName" 
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Device Name (optional)
            </label>
            <input
              id="deviceName"
              type="text"
              value={deviceName}
              onChange={(e) => updateForm({ deviceName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="Name this device (e.g., 'My iPhone')"
            />
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={isLoading}
          className={`w-full px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            isLoading ? 'opacity-70 cursor-not-allowed' : ''
          }`}
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              {mode === 'login' ? 'Signing In...' : 'Registering...'}
            </span>
          ) : (
            <span>{mode === 'login' ? 'Sign In' : 'Register'}</span>
          )}
        </button>
      </form>

      {/* Toggle between login and register */}
      <div className="mt-4 text-center">
        <button
          onClick={toggleMode}
          className="text-blue-600 hover:underline focus:outline-none dark:text-blue-400"
          disabled={isLoading}
        >
          {mode === 'login'
            ? "Don't have an account? Register"
            : 'Already have an account? Sign In'}
        </button>
      </div>

      {/* Info about passkeys */}
      <div className="mt-6 text-xs text-gray-500 dark:text-gray-400">
        <p className="mb-1">
          <strong>About Passkeys:</strong> Passkeys are a secure alternative to passwords 
          that use biometrics (like your fingerprint or face) or device PIN to verify your identity.
        </p>
        <p>
          Your biometric data never leaves your device. Instead, a unique encrypted key is created
          for this application.
        </p>
      </div>
    </div>
  );
}

