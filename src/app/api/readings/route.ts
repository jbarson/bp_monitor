import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { getCurrentUser } from '@/lib/auth';

const prisma = new PrismaClient();

// Schema for reading creation
const createReadingSchema = z.object({
  systolic: z.number()
    .int()
    .min(70, 'Systolic pressure is too low (min: 70)')
    .max(200, 'Systolic pressure is too high (max: 200)'),
  diastolic: z.number()
    .int()
    .min(40, 'Diastolic pressure is too low (min: 40)')
    .max(130, 'Diastolic pressure is too high (max: 130)'),
  heartRate: z.number()
    .int()
    .min(40, 'Heart rate is too low (min: 40)')
    .max(200, 'Heart rate is too high (max: 200)'),
  readingOrder: z.number().int().min(1).max(3),
  sessionId: z.string().nonempty()
});

// Schema for reading query parameters
const readingsQuerySchema = z.object({
  sessionId: z.string().optional(),
  limit: z.string().transform(Number).optional(),
  page: z.string().transform(Number).optional(),
});

// Create a new blood pressure reading
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const result = createReadingSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: result.error.format() }, 
        { status: 400 }
      );
    }

    const { systolic, diastolic, heartRate, readingOrder, sessionId } = result.data;

    // Verify session exists and belongs to the current user
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { readings: true }
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.userId !== user.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Check if we already have 3 readings
    if (session.readings.length >= 3) {
      return NextResponse.json(
        { error: 'Session already has 3 readings' }, 
        { status: 400 }
      );
    }

    // Check if the reading order is already taken
    const existingReading = session.readings.find(r => r.readingOrder === readingOrder);
    if (existingReading) {
      return NextResponse.json(
        { error: `Reading order ${readingOrder} already exists in this session` }, 
        { status: 400 }
      );
    }

    // Create the reading
    const reading = await prisma.bloodPressureReading.create({
      data: {
        systolic,
        diastolic,
        heartRate,
        readingOrder,
        sessionId,
      }
    });

    return NextResponse.json(reading);
  } catch (error) {
    console.error('Error creating reading:', error);
    return NextResponse.json(
      { error: 'Failed to create reading' }, 
      { status: 500 }
    );
  }
}

// Get blood pressure readings
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    
    const queryResult = readingsQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryResult.error.format() }, 
        { status: 400 }
      );
    }

    const { sessionId, limit = 10, page = 1 } = queryResult.data;
    const skip = (page - 1) * limit;

    // Build query
    const whereClause: any = {};
    
    if (sessionId) {
      // If sessionId provided, check if session belongs to user
      const session = await prisma.session.findUnique({
        where: { id: sessionId }
      });
      
      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      
      if (session.userId !== user.userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
      
      whereClause.sessionId = sessionId;
    } else {
      // Otherwise, get all readings from user's sessions
      whereClause.session = {
        userId: user.userId
      };
    }

    // Get the readings
    const readings = await prisma.bloodPressureReading.findMany({
      where: whereClause,
      orderBy: [
        { timestamp: 'desc' },
        { readingOrder: 'asc' }
      ],
      take: limit,
      skip,
      include: {
        session: {
          select: {
            date: true,
            notes: true,
            complete: true
          }
        }
      }
    });

    // Get total count for pagination
    const totalReadings = await prisma.bloodPressureReading.count({
      where: whereClause
    });

    return NextResponse.json({
      readings,
      pagination: {
        total: totalReadings,
        page,
        limit,
        pages: Math.ceil(totalReadings / limit)
      }
    });
  } catch (error) {
    console.error('Error retrieving readings:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve readings' }, 
      { status: 500 }
    );
  }
}

