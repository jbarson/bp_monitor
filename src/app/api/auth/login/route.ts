import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { 
  generateWebAuthnAuthenticationOptions, 
  verifyWebAuthnAuthentication
} from '@/lib/auth';

// Schema for login start request
const startLoginSchema = z.object({
  email: z.string().email()
});

// Schema for login verification request
const verifyLoginSchema = z.object({
  assertionResponse: z.object({}).passthrough() // WebAuthn response is complex and validated elsewhere
});

// Generate authentication options
export async function POST(request: NextRequest) {
  try {
    // Parse and validate the request body
    const body = await request.json();
    const result = startLoginSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }

    const { email } = result.data;

    // Generate authentication options
    const options = await generateWebAuthnAuthenticationOptions(email);

    if (!options) {
      return NextResponse.json(
        { error: 'No passkeys found for this user. Please register first.' }, 
        { status: 404 }
      );
    }

    // Return the options to the client
    return NextResponse.json({ options });
  } catch (error) {
    console.error('Authentication options error:', error);
    return NextResponse.json(
      { error: 'Failed to generate authentication options' }, 
      { status: 500 }
    );
  }
}

// Handle authentication verification
export async function PUT(request: NextRequest) {
  try {
    // Parse and validate the request body
    const body = await request.json();
    const result = verifyLoginSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }

    const { assertionResponse } = result.data;

    // Verify the authentication
    const verification = await verifyWebAuthnAuthentication(assertionResponse);

    if (!verification.verified) {
      return NextResponse.json(
        { error: 'Authentication failed. Please try again.' }, 
        { status: 401 }
      );
    }

    // Return success with user details (note: the token is already set as a cookie in verifyWebAuthnAuthentication)
    return NextResponse.json({ 
      success: true,
      user: {
        id: verification.user.id,
        name: verification.user.name,
        email: verification.user.email
      }
    });
  } catch (error) {
    console.error('Authentication verification error:', error);
    
    // Determine if it's a client error or server error
    const status = error instanceof Error && 
      (error.message.includes('not found') || error.message.includes('challenge')) 
      ? 400 
      : 500;
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Authentication failed' }, 
      { status }
    );
  }
}

// Handle logout request
export async function DELETE(request: NextRequest) {
  // Clear the auth cookie
  const response = NextResponse.json({ success: true });
  response.cookies.delete('auth-token');
  
  return response;
}

