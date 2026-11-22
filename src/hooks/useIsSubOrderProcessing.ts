import { useAppSelector } from '@hooks/reduxHooks';

/** True while a participant's pick for this date is still queued. */
export const useIsSubOrderProcessing = (
  planId?: string,
  subOrderDate?: string | number,
) =>
  useAppSelector(
    (state) =>
      !!planId &&
      subOrderDate !== undefined &&
      !!state.ParticipantOrderJob.processingDaysByPlan[planId]?.includes(
        String(subOrderDate),
      ),
  );
