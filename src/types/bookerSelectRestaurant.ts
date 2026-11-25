export type CombinedRestaurantMenuData = {
  restaurantId: string;
  menuId: string;
};

export type KeywordsCombinedMenuData = CombinedRestaurantMenuData & {
  foundKeywordsTitle: boolean;
};

export type TFoodInRestaurant = {
  foodId: string;
  restaurantId: string;
  /** Client price: the partner's base price plus the menu's extra fee. */
  price: number;
  partnerPrice: number;
  minQuantity: number;
  foodName: string;
  foodUnit: string;
  numberOfMainDishes?: number;
};
