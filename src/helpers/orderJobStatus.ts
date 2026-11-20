import { doc, onSnapshot } from 'firebase/firestore';

import { firestore, setCollectionDocWithCustomId } from '@services/firebase';

// Separate from NEXT_PUBLIC_FIREBASE_MEMBER_ORDERS_COLLECTION_NAME: the legacy
// updateMemberOrders Lambda drains that one and writes plans without the lock.
// Must stay a literal process.env.X read: Next only inlines that form into the
// browser bundle, a destructured read is undefined client-side.
const ORDER_JOB_STATUS_COLLECTION =
  process.env.NEXT_PUBLIC_FIREBASE_ORDER_JOB_STATUS_COLLECTION_NAME!;

export type TOrderJobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export type TOrderJobStatusDoc = {
  status: TOrderJobStatus;
  submissionId: string;
  error?: string;
  updatedAt: string;
};

const buildDocumentId = (planId: string, userId: string) =>
  `${planId}-${userId}`;

export const setOrderJobStatus = ({
  planId,
  userId,
  submissionId,
  status,
  error,
}: {
  planId: string;
  userId: string;
  submissionId: string;
  status: TOrderJobStatus;
  error?: string;
}) =>
  setCollectionDocWithCustomId(
    buildDocumentId(planId, userId),
    {
      status,
      submissionId,
      ...(error && { error }),
      updatedAt: new Date().toISOString(),
    },
    ORDER_JOB_STATUS_COLLECTION,
  );

/**
 * Resolves when the job of this submission finishes. Status docs of another
 * submission (an older or newer pick by the same user) are ignored; `timeout`
 * lets the caller fall back to reloading the plan.
 */
export const waitForOrderJobStatus = ({
  planId,
  userId,
  submissionId,
  timeoutMs = 120000,
}: {
  planId: string;
  userId: string;
  submissionId: string;
  timeoutMs?: number;
}) =>
  new Promise<
    { status: 'completed' | 'timeout' } | { status: 'failed'; error: string }
  >((resolve) => {
    let unsubscribe = () => {};
    const timer = setTimeout(() => {
      unsubscribe();
      resolve({ status: 'timeout' });
    }, timeoutMs);
    const finish = (
      result:
        | { status: 'completed' | 'timeout' }
        | { status: 'failed'; error: string },
    ) => {
      clearTimeout(timer);
      unsubscribe();
      resolve(result);
    };

    try {
      unsubscribe = onSnapshot(
        doc(
          firestore,
          ORDER_JOB_STATUS_COLLECTION,
          buildDocumentId(planId, userId),
        ),
        (snapshot) => {
          const data = snapshot.data() as TOrderJobStatusDoc | undefined;
          if (data?.submissionId !== submissionId) return;
          if (data.status === 'completed') finish({ status: 'completed' });
          if (data.status === 'failed') {
            finish({ status: 'failed', error: data.error || 'Unknown error' });
          }
        },
        // A listener error must not leave the UI waiting for the full timeout.
        () => finish({ status: 'timeout' }),
      );
    } catch (error) {
      console.error('Cannot watch order job status', error);
      finish({ status: 'timeout' });
    }
  });
