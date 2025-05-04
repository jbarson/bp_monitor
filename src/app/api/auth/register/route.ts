import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { 
  generateWebAuthnRegistrationOptions, 
  verifyWebAuthnRegistration 
} from '@/lib/auth';

// Schema for registration start request
const startRegistrationSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1)
});

// Schema for registration verification request
const verifyRegistrationSchema = z.object({
  email: z.string().email(),
  deviceName: z.string().optional(),
  attestationResponse: z.object({}).passthrough() // WebAuthn response is complex and validated elsewhere
});

// Generate registration options
export async function POST(request: NextRequest) {
  try {
    // Parse and validate the request body
    const body = await request.json();
    const result = startRegistrationSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }

    const { email, name } = result.data;

    // Generate registration options
    const options = await generateWebAuthnRegistrationOptions(email, name);

    // Return the options to the client
    return NextResponse.json({ options });
  } catch (error) {
    console.error('Registration options error:', error);
    return NextResponse.json(
      { error: 'Failed to generate registration options' }, 
      { status: 500 }
    );
  }
}

// Handle registration verification
export async function PUT(request: NextRequest) {
  try {
    // Parse and validate the request body
    const body = await request.json();
    const result = verifyRegistrationSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }

    const { email, attestationResponse, deviceName } = result.data;

    // Verify the registration
    const verification = await verifyWebAuthnRegistration(
      email, 
      attestationResponse, 
      deviceName
    );

    if (!verification.verified) {
      return NextResponse.json({ error: 'Registration verification failed' }, { status: 400 });
    }

    // Return success
    return NextResponse.json({ 
      success: true,
      message: 'Passkey registered successfully' 
    });
  } catch (error) {
    console.error('Registration verification error:', error);
    
    // Determine if it's a client error or server error
    const status = error instanceof Error && 
      (error.message.includes('not found') || error.message.includes('challenge')) 
      ? 400 
      : 500;
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Registration verification failed' }, 
      { status }
    );
  }
}

