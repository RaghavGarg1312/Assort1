import { NextResponse } from 'next/server';
import { getAuthUser } from '@/app/api/helper';
import { computeUserStats } from '@/lib/stats';

export async function GET(request: Request) {
  const userOrResponse = await getAuthUser(request);
  if (userOrResponse instanceof NextResponse) return userOrResponse;

  const { id: userId, companyId } = userOrResponse;

  try {
    const stats = await computeUserStats(userId, companyId);
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Personal dashboard stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
