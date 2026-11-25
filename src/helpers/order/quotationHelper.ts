import type { TPricedFoodData } from './partnerPriceHelper';
import { toClientFoodData, toPartnerFoodData } from './partnerPriceHelper';

export type TQuotationFoodRow = TPricedFoodData & {
  foodId: string;
  foodName: string;
  frequency: number;
  foodUnit?: string;
  numberOfMainDishes?: number;
  notes?: string[];
};

type TStoredQuotationFoodRow = Omit<TQuotationFoodRow, 'foodPartnerPrice'>;

export type TFoodOrderOfDate = {
  date: string;
  index?: number;
  restaurantId: string;
  restaurantName: string;
  totalDishes?: number;
  totalPrice?: number;
  foodDataList: TQuotationFoodRow[];
};

/**
 * Builds the client side of a quotation: food rows per delivery date.
 * @param foodOrderGroupedByDate - Food rows grouped by delivery date.
 * @returns `{ quotation: { [date]: foodRows } }` with client prices only.
 */
export const calculateClientQuotation = (
  foodOrderGroupedByDate: TFoodOrderOfDate[],
) => ({
  quotation: foodOrderGroupedByDate.reduce<
    Record<string, TStoredQuotationFoodRow[]>
  >(
    (result, item) => ({
      ...result,
      [item.date]: item.foodDataList.map(toClientFoodData),
    }),
    {},
  ),
});

/**
 * Builds the partner side of a quotation: food rows per restaurant and date.
 * @param groupByRestaurantQuotationData - Food rows grouped by restaurant id.
 * @returns `{ [restaurantId]: { name, quotation: { [date]: foodRows } } }`
 *   where every `foodPrice` is the partner price.
 */
export const calculatePartnerQuotation = (
  groupByRestaurantQuotationData: Record<string, TFoodOrderOfDate[]>,
) =>
  Object.entries(groupByRestaurantQuotationData).reduce(
    (result, [restaurantId, foodOrders]) => ({
      ...result,
      [restaurantId]: {
        name: foodOrders[0].restaurantName,
        quotation: foodOrders.reduce<Record<string, TStoredQuotationFoodRow[]>>(
          (quotation, foodOrder) => ({
            ...quotation,
            [foodOrder.date]: foodOrder.foodDataList.map(toPartnerFoodData),
          }),
          {},
        ),
      },
    }),
    {},
  );
