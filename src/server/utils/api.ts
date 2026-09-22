import { NextResponse } from 'next/server';
import { ApiError } from '@/utils/api';

export async function apiResponse(operation: () => Promise<Response>) {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    throw error;
  }
}

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError('Request body must be valid JSON', 400);
  }
}
