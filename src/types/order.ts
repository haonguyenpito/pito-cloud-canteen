import type { EParticipantOrderStatus } from '@src/utils/enums';

import type { FoodListing, RestaurantListing } from '.';

export type TLineItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  unitPrice: number;
};

export type TCartItem = {
  status?: EParticipantOrderStatus;
  foodId: string;
  requirement?: string;
  secondaryFoodId?: string;
  secondaryRequirement?: string;
};

export type TMemberOrders = {
  [participantId: string]: TCartItem;
};

export type TMemberOrderDetail = TMemberOrders;

export type TShoppingCartMemberPlan = {
  [dayId: string]: {
    [memberId: string]: TCartItem;
  };
};

export type TPlanOrder = {
  [dayId: string]: {
    memberOrders: TMemberOrders;
  };
};

export type TUpdateParticipantOrderBody = {
  orderId: string;
  orderDays?: string[]; // for manual pick food
  planId: string;
  planData?: TShoppingCartMemberPlan; // for manual pick food
  orderDay?: string; // for auto pick food
  memberOrders?: TMemberOrders; // for auto pick food
};

export type TFirebaseMemberOrder = TUpdateParticipantOrderBody;

export type TFood = {
  foodName: string;
  foodPrice: number;
  foodUnit: string;
  numberOfMainDishes?: number;
};

export type TOrderDetailRestaurant = {
  id: string;
  menuId: string;
  minQuantity: number;
  maxQuantity: number;
  restaurantName: string;
  foodList: {
    [foodId: string]: TFood;
  };
};

export type TOrderDetail = {
  [dayId: string]: {
    hasNoRestaurants: boolean;
    lineItems?: TLineItem[];
    memberOrders: TMemberOrders;
    restaurant: TOrderDetailRestaurant;
    transactionId: string;
    lastTransition: string;
    trackingLink?: string;
  };
};

export type TPlanData = {
  [dayId: string]: {
    foodList: FoodListing[];
    restaurant: RestaurantListing;
    /** Menu-scoped extra fee per dish, from the plan snapshot. */
    foodExtraFees?: Record<string, number>;
    memberOrder: TMemberOrderDetail;
  };
};
