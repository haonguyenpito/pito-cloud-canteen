import type { EParticipantOrderStatus } from './enums';
import type { ETransition } from './transaction';

export type TFoodList = {
  [foodId: string]: {
    foodName: string;
    foodPrice: number;
    /** Menu-scoped extra fee snapshotted at pick time — part of the billed total. */
    foodExtraFee?: number;
    foodUnit?: string;
    numberOfMainDishes: number | string;
  };
};

export type TPlan = {
  meal: string;
  orderDetail: {
    [date: string]: {
      note?: any;
      transactionId?: string;
      lastTransition?: ETransition;
      restaurant: {
        id?: string; // restaurant listing id
        menuId?: string;
        minQuantity?: number;
        maxQuantity?: number;
        restaurantName?: string;
        foodList?: TFoodList;
      };
      memberOrders: {
        [participant: string]: {
          foodId: string;
          status: EParticipantOrderStatus;
          requirement?: string;
          secondaryFoodId?: string;
          secondaryRequirement?: string;
        };
      };

      lineItems?: {
        id: string;
        name: string;
        quantity: number;
        price: number;
        unitPrice: number;
        unitExtraFee?: number;
      }[];
    };
  };
};
