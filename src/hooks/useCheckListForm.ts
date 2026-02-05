import { useCallback, useState } from 'react';

import { createChecklistApi, getChecklistApi } from '@apis/orderApi';
import type { TCreateChecklistApiBody } from '@src/utils/types';

/**
 * Hook for checklist form operations
 * @param orderId - Order ID
 * @param subOrderDate - Sub order date
 * @returns Checklist operations (create, get)
 */
const useCheckListForm = (orderId: string, subOrderDate: string) => {
  const [isCreateChecklistLoading, setIsCreateChecklistLoading] =
    useState(false);
  const [isGetChecklistLoading, setIsGetChecklistLoading] = useState(false);
  /**
   * Create checklist
   * @param body - Checklist data
   * @returns Created checklist data
   */
  const createChecklist = useCallback(
    async (body: TCreateChecklistApiBody) => {
      try {
        setIsCreateChecklistLoading(true);
        const response = await createChecklistApi(orderId, subOrderDate, body);

        return response.data;
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error creating checklist:', error);
        throw error;
      } finally {
        setIsCreateChecklistLoading(false);
      }
    },
    [orderId, subOrderDate],
  );

  /**
   * Get checklist
   * @returns Checklist data
   */
  const getChecklist = useCallback(async () => {
    try {
      setIsGetChecklistLoading(true);
      const response = await getChecklistApi(orderId, subOrderDate);

      return response.data.data;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error getting checklist:', error);
      throw error;
    } finally {
      setIsGetChecklistLoading(false);
    }
  }, [orderId, subOrderDate]);

  return {
    createChecklist,
    getChecklist,
    isCreateChecklistLoading,
    isGetChecklistLoading,
  };
};

export default useCheckListForm;
