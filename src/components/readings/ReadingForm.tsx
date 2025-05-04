'use client';

import { useState, useEffect } from 'react';
import { z } from 'zod';

// Types for reading session management
export type Reading = {
  id?: string;
  systolic: number;
  diastolic: number;
  heartRate: number;
  readingOrder: number;
  timestamp: Date;
};

export type ReadingSession = {
  id?: string;
  date: Date;
  notes?: string;
  complete: boolean;
  readings: Reading[];
};

// Validation schema for a blood pressure reading
const readingSchema = z.object({
  systolic: z.number()
    .min(70, 'Systolic pressure is too low (min: 70)')
    .max(200, 'Systolic pressure is too high (max: 200)'),
  diastolic: z.number()
    .min(40, 'Diastolic pressure is too low (min: 40)')
    .max(130, 'Diastolic pressure is too high (max: 130)'),
  heartRate: z.number()
    .min(40, 'Heart rate is too low (min: 40)')
    .max(200, 'Heart rate is too high (max: 200)'),
});

// Props for the ReadingForm component
interface ReadingFormProps {
  onSessionComplete?: (session: ReadingSession) => void;
  initialSession?: ReadingSession;
}

export default function ReadingForm({ 
  onSessionComplete, 
  initialSession 
}: ReadingFormProps) {
  // Initialize the form state
  const [formData, setFormData] = useState({
    systolic: '',
    diastolic: '',
    heartRate: '',
    notes: initialSession?.notes || '',
  });

  // Session state
  const [session, setSession] = useState<ReadingSession>(initialSession || {
    date: new Date(),
    complete: false,
    readings: [],
  });

  // Input validation state
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Form submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Determine which reading we're on (1, 2, or 3)
  const currentReadingNumber = session.readings.length + 1;
  const isSessionComplete = session.complete || currentReadingNumber > 3;

  // Reset form fields after a reading is submitted
  const resetFormFields = () => {
    setFormData({
      ...formData,
      systolic: '',
      diastolic: '',
      heartRate: '',
    });
    setErrors({});
  };

  // Handle input changes and real-time validation
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });

    // Clear the error for this field when the user starts typing again
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: '',
      });
    }

    // Clear any form-level messages when user interacts with the form
    if (formError || formSuccess) {
      setFormError(null);
      setFormSuccess(null);
    }
  };

  // Validate a single reading
  const validateReading = (): boolean => {
    try {
      const systolicValue = parseInt(formData.systolic, 10);
      const diastolicValue = parseInt(formData.diastolic, 10);
      const heartRateValue = parseInt(formData.heartRate, 10);

      // Check if values are numbers
      if (isNaN(systolicValue)) {
        setErrors(prev => ({ ...prev, systolic: 'Systolic pressure must be a number' }));
        return false;
      }
      if (isNaN(diastolicValue)) {
        setErrors(prev => ({ ...prev, diastolic: 'Diastolic pressure must be a number' }));
        return false;
      }
      if (isNaN(heartRateValue)) {
        setErrors(prev => ({ ...prev, heartRate: 'Heart rate must be a number' }));
        return false;
      }

      // Validate with zod schema
      readingSchema.parse({
        systolic: systolicValue,
        diastolic: diastolicValue,
        heartRate: heartRateValue,
      });

      // Additional validation: systolic should be greater than diastolic
      if (systolicValue <= diastolicValue) {
        setErrors(prev => ({ 
          ...prev, 
          diastolic: 'Diastolic pressure must be lower than systolic pressure' 
        }));
        return false;
      }

      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Extract and set validation errors
        const newErrors: Record<string, string> = {};
        error.errors.forEach(err => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
      } else {
        setFormError('An unexpected error occurred. Please try again.');
      }
      return false;
    }
  };

  // Handle form submission for a reading
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    // Validate current reading
    if (!validateReading()) {
      return;
    }

    try {
      setIsSubmitting(true);

      // Create the new reading object
      const newReading: Reading = {
        systolic: parseInt(formData.systolic, 10),
        diastolic: parseInt(formData.diastolic, 10),
        heartRate: parseInt(formData.heartRate, 10),
        readingOrder: currentReadingNumber,
        timestamp: new Date(),
      };

      // Start a new session or add to existing one
      let sessionId = session.id;
      let newSession: ReadingSession;

      if (!sessionId) {
        // Create a new session in the database
        const response = await fetch('/api/readings/sessions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            notes: formData.notes,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to create session');
        }

        const sessionData = await response.json();
        sessionId = sessionData.id;
        newSession = {
          ...sessionData,
          readings: [newReading],
        };
      } else {
        // Add to existing session
        newSession = {
          ...session,
          notes: formData.notes,
          readings: [...session.readings, newReading],
        };
      }

      // Add the reading to the database
      const response = await fetch('/api/readings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...newReading,
          sessionId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save reading');
      }

      const readingData = await response.json();

      // Update the session state with the saved reading
      const updatedReadings = [...newSession.readings];
      updatedReadings[updatedReadings.length - 1] = readingData;

      // Check if we've reached 3 readings
      const isComplete = updatedReadings.length >= 3;
      
      // If session is complete, update the session status
      if (isComplete) {
        await fetch(`/api/readings/sessions/${sessionId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            complete: true,
            notes: formData.notes,
          }),
        });
      }

      // Update local state
      const updatedSession = {
        ...newSession,
        id: sessionId,
        readings: updatedReadings,
        complete: isComplete,
      };
      
      setSession(updatedSession);
      setFormSuccess(
        isComplete 
          ? 'Session completed! All 3 readings have been recorded.'
          : `Reading ${currentReadingNumber}/3 recorded successfully.`
      );

      // Reset the form fields for the next reading
      resetFormFields();

      // If the session is complete, call the onSessionComplete callback
      if (isComplete && onSessionComplete) {
        onSessionComplete(updatedSession);
      }
    } catch (error) {
      console.error('Error saving reading:', error);
      setFormError(error instanceof Error ? error.message : 'Failed to save reading');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">
        {isSessionComplete 
          ? 'Session Complete' 
          : `Blood Pressure Reading ${currentReadingNumber}/3`}
      </h2>

      {/* Progress indicator */}
      <div className="mb-6">
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
          <div 
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
            style={{ width: `${(session.readings.length / 3) * 100}%` }}
          />
        </div>
        <div className="flex justify-between mt-1 text-xs text-gray-500 dark:text-gray-400">
          <span>Start</span>
          <span>Reading 2</span>
          <span>Complete</span>
        </div>
      </div>

      {/* Success message */}
      {formSuccess && (
        <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
          {formSuccess}
        </div>
      )}

      {/* Error message */}
      {formError && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {formError}
        </div>
      )}

      {isSessionComplete ? (
        <div className="text-center py-4">
          <div className="mb-4 text-green-600 dark:text-green-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium mb-2">Session Complete!</h3>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            You've successfully recorded all 3 readings for this session.
          </p>
          <button
            onClick={() => {
              setSession({
                date: new Date(),
                complete: false,
                readings: [],
              });
              setFormSuccess(null);
              setFormData({
                systolic: '',
                diastolic: '',
                heartRate: '',
                notes: '',
              });
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Start New Session
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Systolic pressure field */}
            <div>
              <label 
                htmlFor="systolic" 
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Systolic (mmHg)
              </label>
              <input
                id="systolic"
                name="systolic"
                type="number"
                min="70"
                max="200"
                value={formData.systolic}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border ${errors.systolic ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white`}
                placeholder="120"
                required
              />
              {errors.systolic && (
                <p className="mt-1 text-sm text-red-600">{errors.systolic}</p>
              )}
            </div>

            {/* Diastolic pressure field */}
            <div>
              <label 
                htmlFor="diastolic" 
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Diastolic (mmHg)
              </label>
              <input
                id="diastolic"
                name="diastolic"
                type="number"
                min="40"
                max="130"
                value={formData.diastolic}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border ${errors.diastolic ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white`}
                placeholder="80"
                required
              />
              {errors.diastolic && (
                <p className="mt-1 text-sm text-red-600">{errors.diastolic}</p>
              )}
            </div>

            {/* Heart rate field */}
            <div>
              <label 
                htmlFor="heartRate" 
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Heart Rate (BPM)
              </label>
              <input
                id="heartRate"
                name="heartRate"
                type="number"
                min="40"
                max="200"
                value={formData.heartRate}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border ${errors.heartRate ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white`}
                placeholder="75"
                required
              />
              {errors.heartRate && (
                <p className="mt-1 text-sm text-red-600">{errors.heartRate}</p>
              )}
            </div>
          </div>

          {/* Notes field */}
          <div>
            <label 
              htmlFor="notes" 
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Notes (optional)
            </label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Any additional information about this reading..."
            />
          </div>

          {/* Submit button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {isSubmitting ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  Saving...
                </span>
              ) : (
                `Record Reading ${currentReadingNumber}/3`
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
