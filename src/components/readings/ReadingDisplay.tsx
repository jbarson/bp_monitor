'use client';

import { Reading, ReadingSession } from './ReadingForm';

// Define normal ranges for color coding
const RANGES = {
  systolic: {
    low: 90,
    normal: 120,
    elevated: 130,
    high: 140,
    crisis: 180
  },
  diastolic: {
    low: 60,
    normal: 80,
    high: 90,
    crisis: 120
  },
  heartRate: {
    low: 60,
    normal: 100,
    high: 140
  }
};

// Helper function to calculate average of numbers
const calculateAverage = (numbers: number[]): number => {
  if (numbers.length === 0) return 0;
  const sum = numbers.reduce((acc, val) => acc + val, 0);
  return Math.round(sum / numbers.length);
};

// Helper function to get color class based on value and range
const getColorClass = (value: number, type: 'systolic' | 'diastolic' | 'heartRate'): string => {
  const range = RANGES[type];
  
  if (type === 'systolic') {
    if (value < range.low) return 'text-blue-600';
    if (value < range.normal) return 'text-green-600';
    if (value < range.elevated) return 'text-yellow-600';
    if (value < range.high) return 'text-orange-600';
    if (value < range.crisis) return 'text-red-600';
    return 'text-red-700 font-bold';
  } 
  else if (type === 'diastolic') {
    if (value < range.low) return 'text-blue-600';
    if (value < range.normal) return 'text-green-600';
    if (value < range.high) return 'text-orange-600';
    if (value < range.crisis) return 'text-red-600';
    return 'text-red-700 font-bold';
  }
  else { // heart rate
    if (value < range.low) return 'text-blue-600';
    if (value < range.normal) return 'text-green-600';
    if (value < range.high) return 'text-orange-600';
    return 'text-red-600';
  }
};

interface ReadingDisplayProps {
  session: ReadingSession;
}

export default function ReadingDisplay({ session }: ReadingDisplayProps) {
  // Sort readings by order (1, 2, 3)
  const sortedReadings = [...session.readings].sort((a, b) => a.readingOrder - b.readingOrder);
  
  // Extract values for statistics
  const systolicValues = sortedReadings.map(reading => reading.systolic);
  const diastolicValues = sortedReadings.map(reading => reading.diastolic);
  const heartRateValues = sortedReadings.map(reading => reading.heartRate);
  
  // Calculate statistics
  const stats = {
    systolic: {
      min: systolicValues.length ? Math.min(...systolicValues) : 0,
      max: systolicValues.length ? Math.max(...systolicValues) : 0,
      avg: calculateAverage(systolicValues)
    },
    diastolic: {
      min: diastolicValues.length ? Math.min(...diastolicValues) : 0,
      max: diastolicValues.length ? Math.max(...diastolicValues) : 0,
      avg: calculateAverage(diastolicValues)
    },
    heartRate: {
      min: heartRateValues.length ? Math.min(...heartRateValues) : 0,
      max: heartRateValues.length ? Math.max(...heartRateValues) : 0,
      avg: calculateAverage(heartRateValues)
    }
  };

  // Format date function
  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit'
    });
  };

  if (sortedReadings.length === 0) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mt-8">
      <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">
        Current Session Readings
      </h2>
      
      {/* Table of readings */}
      <div className="overflow-x-auto mb-6">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Reading #
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Time
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Systolic (mmHg)
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Diastolic (mmHg)
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Heart Rate (BPM)
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
            {sortedReadings.map((reading) => (
              <tr key={reading.readingOrder}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                  {reading.readingOrder}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {formatTime(reading.timestamp)}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${getColorClass(reading.systolic, 'systolic')}`}>
                  {reading.systolic}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${getColorClass(reading.diastolic, 'diastolic')}`}>
                  {reading.diastolic}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${getColorClass(reading.heartRate, 'heartRate')}`}>
                  {reading.heartRate}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Statistics */}
      <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
        <h3 className="text-md font-medium mb-3 text-gray-800 dark:text-white">
          Session Statistics
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-3 bg-white dark:bg-gray-800 rounded shadow-sm">
            <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Systolic (mmHg)</h4>
            <div className="flex justify-between text-sm">
              <div>
                <span className="block text-gray-500 dark:text-gray-400">Min</span>
                <span className={`font-medium ${getColorClass(stats.systolic.min, 'systolic')}`}>{stats.systolic.min}</span>
              </div>
              <div>
                <span className="block text-gray-500 dark:text-gray-400">Avg</span>
                <span className={`font-medium ${getColorClass(stats.systolic.avg, 'systolic')}`}>{stats.systolic.avg}</span>
              </div>
              <div>
                <span className="block text-gray-500 dark:text-gray-400">Max</span>
                <span className={`font-medium ${getColorClass(stats.systolic.max, 'systolic')}`}>{stats.systolic.max}</span>
              </div>
            </div>
          </div>
          <div className="p-3 bg-white dark:bg-gray-800 rounded shadow-sm">
            <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Diastolic (mmHg)</h4>
            <div className="flex justify-between text-sm">
              <div>
                <span className="block text-gray-500 dark:text-gray-400">Min</span>
                <span className={`font-medium ${getColorClass(stats.diastolic.min, 'diastolic')}`}>{stats.diastolic.min}</span>
              </div>
              <div>
                <span className="block text-gray-500 dark:text-gray-400">Avg</span>
                <span className={`font-medium ${getColorClass(stats.diastolic.avg, 'diastolic')}`}>{stats.diastolic.avg}</span>
              </div>
              <div>
                <span className="block text-gray-500 dark:text-gray-400">Max</span>
                <span className={`font-medium ${getColorClass(stats.diastolic.max, 'diastolic')}`}>{stats.diastolic.max}</span>
              </div>
            </div>
          </div>
          <div className="p-3 bg-white dark:bg-gray-800 rounded shadow-sm">
            <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Heart Rate (BPM)</h4>
            <div className="flex justify-between text-sm">
              <div>
                <span className="block text-gray-500 dark:text-gray-400">Min</span>
                <span className={`font-medium ${getColorClass(stats.heartRate.min, 'heartRate')}`}>{stats.heartRate.min}</span>
              </div>
              <div>
                <span className="block text-gray-500 dark:text-gray-400">Avg</span>
                <span className={`font-medium ${getColorClass(stats.heartRate.avg, 'heartRate')}`}>{stats.heartRate.avg}</span>
              </div>
              <div>
                <span className="block text-gray-500 dark:text-gray-400">Max</span>
                <span className={`font-medium ${getColorClass(stats.heartRate.max, 'heartRate')}`}>{stats.heartRate.max}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      {session.notes && (
        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <h3 className="text-md font-medium mb-2 text-gray-800 dark:text-white">
            Notes
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {session.notes}
          </p>
        </div>
      )}
    </div>
  );
}

