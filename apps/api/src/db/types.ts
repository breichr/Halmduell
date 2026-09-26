import type { db } from './client';

/** Transaktions-Handle aus db.transaction(async (tx) => …) */
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
