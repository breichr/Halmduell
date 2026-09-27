import { and, eq, or, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { friendships } from '../db/schema';

/** Die andere Seite einer Freundschaftszeile aus Sicht von `ich` */
export const andere = (ich: number) =>
  sql<number>`case when ${friendships.userId} = ${ich} then ${friendships.friendId} else ${friendships.userId} end`;

/** IDs meiner bestätigten Freunde */
export async function freundIds(ich: number): Promise<number[]> {
  const zeilen = await db.select({ id: andere(ich) }).from(friendships)
    .where(and(eq(friendships.status, 'bestaetigt'), or(eq(friendships.userId, ich), eq(friendships.friendId, ich))));
  return zeilen.map((z) => z.id);
}
