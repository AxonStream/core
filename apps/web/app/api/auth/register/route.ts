import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, organizationSlug, firstName, lastName } = body;

    // Validate required fields
    if (!email || !password || !organizationSlug) {
      return NextResponse.json(
        { error: 'Email, password, and organization slug are required' },
        { status: 400 }
      );
    }

    // Simulate user registration
    const user = {
      id: Math.random().toString(36).substr(2, 9),
      email,
      firstName: firstName || 'User',
      lastName: lastName || 'Name',
      organizationSlug,
      createdAt: new Date().toISOString()
    };

    const accessToken = `jwt_${Math.random().toString(36).substr(2, 20)}`;

    return NextResponse.json({
      success: true,
      message: 'User registered successfully',
      user,
      accessToken
    }, { status: 201 });

  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
