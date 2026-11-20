import type { Dispatch } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';

import { waitForOrderJobStatus } from '@helpers/orderJobStatus';

// ================ Initial states ================ //
type TParticipantOrderJobState = {
  /** Sub-order dates whose pick is still queued in processOrder.job. */
  processingDaysByPlan: Record<string, string[]>;
};
const initialState: TParticipantOrderJobState = {
  processingDaysByPlan: {},
};

type TProcessingDaysPayload = { planId: string; days: string[] };

// ================ Slice ================ //
const ParticipantOrderJobSlice = createSlice({
  name: 'ParticipantOrderJob',
  initialState,
  reducers: {
    startProcessing: (
      state,
      { payload: { planId, days } }: { payload: TProcessingDaysPayload },
    ) => {
      state.processingDaysByPlan[planId] = Array.from(
        new Set([...(state.processingDaysByPlan[planId] || []), ...days]),
      );
    },
    finishProcessing: (
      state,
      { payload: { planId, days } }: { payload: TProcessingDaysPayload },
    ) => {
      state.processingDaysByPlan[planId] = (
        state.processingDaysByPlan[planId] || []
      ).filter((day) => !days.includes(day));
    },
  },
});

// ================ Actions ================ //
export const ParticipantOrderJobActions = ParticipantOrderJobSlice.actions;
export default ParticipantOrderJobSlice.reducer;

/**
 * Marks the dates as processing from the click until the queued pick is
 * persisted. `submit` calls the queueing API. Throws when the request or the
 * job finally fails so the caller's error path runs; a timeout resolves so the
 * caller just reloads the plan.
 */
export const runParticipantOrderJob = async <
  TResponse extends { submissionId: string },
>({
  dispatch,
  planId,
  userId,
  days,
  submit,
}: TProcessingDaysPayload & {
  dispatch: Dispatch;
  userId: string;
  submit: () => Promise<TResponse>;
}): Promise<TResponse> => {
  const normalizedDays = days.map(String);
  dispatch(
    ParticipantOrderJobActions.startProcessing({
      planId,
      days: normalizedDays,
    }),
  );
  try {
    const response = await submit();
    const result = await waitForOrderJobStatus({
      planId,
      userId,
      submissionId: response.submissionId,
    });
    if (result.status === 'failed') {
      throw new Error(result.error);
    }

    return response;
  } finally {
    dispatch(
      ParticipantOrderJobActions.finishProcessing({
        planId,
        days: normalizedDays,
      }),
    );
  }
};
