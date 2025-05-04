import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { getCurrentUser } from '@/lib/auth';

const prisma = new PrismaClient();

// Schema for session update
const updateSessionSchema = z.object({
  notes: z.string().optional(),
  complete: z.boolean().optional(),
});

// Helper to check session ownership
async function getSessionWithOwnershipCheck(sessionId: string, userId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      readings: {
        orderBy: {
          readingOrder: 'asc'
        }
      }
    }
  });

  if (!session) {
    return { error: 'Session not found', status: 404 };
  }

  if (session.userId !== userId) {
    return { error: 'Unauthorized', status: 403 };
  }

  return { session };
}

// Get a specific session with its readings
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sessionId = params.id;
    
    // Check ownership and get session
    const { session, error, status } = await getSessionWithOwnershipCheck(sessionId, user.userId);
    
    if (error) {
      return NextResponse.json({ error }, { status });
    }

    return NextResponse.json(session);
  } catch (error) {
    console.error('Error retrieving session:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve session' }, 
      { status: 500 }
    );
  }
}

// Update a session
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sessionId = params.id;
    
    // Parse and validate request body
    const body = await request.json();
    const result = updateSessionSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: result.error.format() }, 
        { status: 400 }
      );
    }

    // Check ownership and get session
    const { session, error, status } = await getSessionWithOwnershipCheck(sessionId, user.userId);
    
    if (error) {
      return NextResponse.json({ error }, { status });
    }

    // Special validation for completion status
    if (result.data.complete === true) {
      // Check if the session has 3 readings before marking as complete
      if (session.readings.length < 3) {
        return NextResponse.json(
          { error: 'Cannot mark session as complete. Session must have 3 readings.' }, 
          { status: 400 }
        );
      }
    }

    // Update the session
    const updatedSession = await prisma.session.update({
      where: { id: sessionId },
      data: result.data,
      include: {
        readings: {
          orderBy: {
            readingOrder: 'asc'
          }
        }
      }
    });

    return NextResponse.json(updatedSession);
  } catch (error) {
    console.error('Error updating session:', error);
    return NextResponse.json(
      { error: 'Failed to update session' }, 
      { status: 500 }
    );
  }
}

// Delete a session and its readings
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sessionId = params.id;
    
    // Check ownership and get session
    const { session, error, status } = await getSessionWithOwnershipCheck(sessionId, user.userId);
    
    if (error) {
      return NextResponse.json({ error }, { status });
    }

    // Prevent deletion of completed sessions
    if (session.complete) {
      return NextResponse.json(
        { error: 'Cannot delete a completed session. This is to preserve your medical history.' }, 
        { status: 400 }
      );
    }

    // Delete all readings first (cascade not automatic in Prisma)
    await prisma.bloodPressureReading.deleteMany({
      where: { sessionId }
    });

    // Delete the session
    await prisma.session.delete({
      where: { id: sessionId }
    });

    return NextResponse.json({ success: true, message: 'Session deleted successfully' });
  } catch (error) {
    console.error('Error deleting session:', error);
    return NextResponse.json(
      { error: 'Failed to delete session' }, 
      { status: 500 }
    );
  }
}

