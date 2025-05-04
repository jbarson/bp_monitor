import { 
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticationVerificationResult,
  type RegistrationResponseJSON,
  type VerifiedRegistration,
} from '@simplewebauthn/server';
import type { 
  AuthenticationOptionsJSON, 
  RegistrationOptionsJSON 
} from '@simplewebauthn/browser';
import { PrismaClient } from '@prisma/client';
import { cookies } from 'next/headers';
import { jwtVerify, SignJWT } from 'jose';

const prisma = new PrismaClient();

// Secret key for JWT signing - in production, use a secure environment variable
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-at-least-32-characters-long'
);

// Session expiration time
const SESSION_EXPIRATION = '7d';

// The RP ID is the domain name of your app
const RP_ID = process.env.RPID || 'localhost';
// The RP name is the name of your app
const RP_NAME = 'BP Monitor';
// The RP origin is the URL of your app
const RP_ORIGIN = process.env.NODE_ENV === 'production' 
  ? `https://${RP_ID}` 
  : `http://${RP_ID}:3000`;

// Type for user session
export type UserSession = {
  userId: string;
  email: string;
  name: string;
  exp: number;
};

// Generate registration options for a new user
export async function generateWebAuthnRegistrationOptions(
  email: string,
  name: string
): Promise<RegistrationOptionsJSON> {
  // Create the user if they don't exist yet
  let user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name,
      },
    });
  }

  // Get existing authenticators for this user
  const existingCredentials = await prisma.passkeyCredential.findMany({
    where: { userId: user.id },
    select: { credentialId: true },
  });

  // Generate registration options
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID: user.id,
    userName: user.email,
    userDisplayName: user.name,
    attestationType: 'none',
    excludeCredentials: existingCredentials.map(cred => ({
      id: Buffer.from(cred.credentialId, 'base64url'),
      type: 'public-key',
    })),
    authenticatorSelection: {
      residentKey: 'required',
      userVerification: 'preferred',
    },
  });

  // Store options in a temporary challenge cookie
  cookies().set('webauthn-registration-challenge', options.challenge, { 
    httpOnly: true, 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 10 * 60, // 10 minutes
    path: '/',
  });

  return options;
}

// Verify registration response
export async function verifyWebAuthnRegistration(
  email: string, 
  response: RegistrationResponseJSON,
  deviceName?: string
): Promise<VerifiedRegistration> {
  // Get the user
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Get the expected challenge from the cookie
  const challengeCookie = cookies().get('webauthn-registration-challenge');
  
  if (!challengeCookie) {
    throw new Error('Registration challenge not found');
  }
  
  const expectedChallenge = challengeCookie.value;

  // Clear the challenge cookie
  cookies().delete('webauthn-registration-challenge');

  // Verify the attestation
  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: RP_ORIGIN,
    expectedRPID: RP_ID,
  });

  if (verification.verified && verification.registrationInfo) {
    // Save the new credential to the database
    await prisma.passkeyCredential.create({
      data: {
        credentialId: verification.registrationInfo.credentialID.toString('base64url'),
        publicKey: verification.registrationInfo.credentialPublicKey.toString('base64url'),
        counter: BigInt(verification.registrationInfo.counter),
        transports: response.response.transports?.join(','),
        device: deviceName || 'Unknown device',
        userId: user.id,
      },
    });
  }

  return verification;
}

// Generate authentication options
export async function generateWebAuthnAuthenticationOptions(
  email: string
): Promise<AuthenticationOptionsJSON | null> {
  // Find the user
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      passkeys: true,
    },
  });

  if (!user || user.passkeys.length === 0) {
    return null;
  }

  // Generate authentication options
  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: 'preferred',
    allowCredentials: user.passkeys.map(cred => ({
      id: Buffer.from(cred.credentialId, 'base64url'),
      type: 'public-key',
      transports: cred.transports?.split(',') as AuthenticatorTransport[],
    })),
  });

  // Store options in a temporary challenge cookie
  cookies().set('webauthn-authentication-challenge', options.challenge, { 
    httpOnly: true, 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 10 * 60, // 10 minutes
    path: '/',
  });

  // Store user ID in a temporary cookie for the verification
  cookies().set('webauthn-authentication-userid', user.id, { 
    httpOnly: true, 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 10 * 60, // 10 minutes
    path: '/',
  });

  return options;
}

// Verify authentication response
export async function verifyWebAuthnAuthentication(
  response: AuthenticationResponseJSON
): Promise<AuthenticationVerificationResult & { user: any }> {
  // Get the expected challenge from the cookie
  const challengeCookie = cookies().get('webauthn-authentication-challenge');
  const userIdCookie = cookies().get('webauthn-authentication-userid');
  
  if (!challengeCookie || !userIdCookie) {
    throw new Error('Authentication challenge or user ID not found');
  }
  
  const expectedChallenge = challengeCookie.value;
  const userId = userIdCookie.value;

  // Clear the cookies
  cookies().delete('webauthn-authentication-challenge');
  cookies().delete('webauthn-authentication-userid');

  // Find the credential in the database
  const credential = await prisma.passkeyCredential.findFirst({
    where: {
      credentialId: response.id,
      userId,
    },
    include: {
      user: true,
    },
  });

  if (!credential) {
    throw new Error('Credential not found');
  }

  // Verify the assertion
  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: RP_ORIGIN,
    expectedRPID: RP_ID,
    authenticator: {
      credentialID: Buffer.from(credential.credentialId, 'base64url'),
      credentialPublicKey: Buffer.from(credential.publicKey, 'base64url'),
      counter: Number(credential.counter),
    },
  });

  if (verification.verified) {
    // Update the credential counter
    await prisma.passkeyCredential.update({
      where: { id: credential.id },
      data: { counter: BigInt(verification.authenticationInfo.newCounter) },
    });

    // Create a session token
    const token = await createSessionToken(credential.user);

    // Set the token as a cookie
    cookies().set('auth-token', token, { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });
  }

  return { ...verification, user: credential.user };
}

// Create a session token
export async function createSessionToken(user: any): Promise<string> {
  const token = await new SignJWT({
    userId: user.id,
    email: user.email,
    name: user.name,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(SESSION_EXPIRATION)
    .sign(JWT_SECRET);

  return token;
}

// Verify a session token
export async function verifySessionToken(token: string): Promise<UserSession | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as UserSession;
  } catch (error) {
    return null;
  }
}

// Get the current user
export async function getCurrentUser(): Promise<UserSession | null> {
  const token = cookies().get('auth-token')?.value;
  
  if (!token) {
    return null;
  }

  return verifySessionToken(token);
}

// Logout user
export async function logoutUser() {
  cookies().delete('auth-token');
}

