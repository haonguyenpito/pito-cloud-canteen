import { SECONDARY_FOOD_ALLOWED_COMPANIES } from '@src/utils/constants';
import { Listing } from '@src/utils/data';
import type { TListing } from '@src/utils/types';

/**
 * Hook to check if the company is allowed to add a second food
 * @param orderListing - Order listing
 * @returns True if the company is allowed to add a second food, false if not
 */
export const useIsAllowAddSecondFood = (orderListing: TListing) => {
  if (!orderListing || !Listing(orderListing).getMetadata().companyId)
    return false;
  const { companyId } = Listing(orderListing).getMetadata();

  return companyId
    ? SECONDARY_FOOD_ALLOWED_COMPANIES.includes(companyId) ?? false
    : false;
};

/**
 * Get whether to allow adding a second food
 * @param companyId - The company id
 * @returns Whether to allow adding a second food
 */
export const getIsAllowAddSecondFood = (companyId: string) => {
  if (!companyId) return false;

  return SECONDARY_FOOD_ALLOWED_COMPANIES.includes(companyId) ?? false;
};
