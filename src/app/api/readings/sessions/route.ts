import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { getCurrentUser } from '@/lib/auth';

const prisma = new PrismaClient();

// Schema for session creation
const createSessionSchema = z.object({
  notes: z.string().optional(),
  date: z.string().datetime().optional(),
});

// Schema for session query parameters
const sessionsQuerySchema = z.object({
  limit: z.string().transform(Number).optional(),
  page: z.string().transform(Number).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  complete: z.enum(['true', 'false']).optional().transform(val => val === 'true'),
  sort: z.enum(['date_asc', 'date_desc']).optional(),
});

// Create a new session
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const result = createSessionSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: result.error.format() }, 
        { status: 400 }
      );
    }

    const { notes, date } = result.data;

    // Create the session
    const session = await prisma.session.create({
      data: {
        userId: user.userId,
        notes,
        date: date ? new Date(date) : new Date(),
        complete: false,
      }
    });

    return NextResponse.json(session);
  } catch (error) {
    console.error('Error creating session:', error);
    return NextResponse.json(
      { error: 'Failed to create session' }, 
      { status: 500 }
    );
  }
}

// Get sessions with pagination and filtering
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    
    const queryResult = sessionsQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryResult.error.format() }, 
        { status: 400 }
      );
    }

    const { 
      limit = 10, 
      page = 1, 
      startDate, 
      endDate, 
      complete,
      sort = 'date_desc',
    } = queryResult.data;
    
    const skip = (page - 1) * limit;

    // Build where clause for filtering
    const whereClause: any = {
      userId: user.userId,
    };

    // Date range filter
    if (startDate || endDate) {
      whereClause.date = {};
      
      if (startDate) {
        whereClause.date.gte = new Date(startDate);
      }
      
      if (endDate) {
        whereClause.date.lte = new Date(endDate);
      }
    }

    // Completion status filter
    if (complete !== undefined) {
      whereClause.complete = complete;
    }

    // Determine sort order
    const orderBy = sort === 'date_asc' 
      ? { date: 'asc' as const } 
      : { date: 'desc' as const };

    // Get sessions with read count
    const sessions = await prisma.session.findMany({
      where: whereClause,
      orderBy,
      take: limit,
      skip,
      include: {
        _count: {
          select: { readings: true }
        },
        readings: {
          select: {
            systolic: true,
            diastolic: true,
            heartRate: true,
            readingOrder: true,
            timestamp: true,
          },
          orderBy: {
            readingOrder: 'asc'
          }
        }
      }
    });

    // Get total count for pagination
    const totalSessions = await prisma.session.count({
      where: whereClause
    });

    return NextResponse.json({
      sessions: sessions.map(session => ({
        ...session,
        readingsCount: session._count.readings,
        _count: undefined, // Remove the _count property from the response
      })),
      pagination: {
        total: totalSessions,
        page,
        limit,
        pages: Math.ceil(totalSessions / limit)
      }
    });
  } catch (error) {
    console.error('Error retrieving sessions:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve sessions' }, 
      { status: 500 }
    );
  }
}

