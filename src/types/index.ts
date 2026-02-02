import type {
  ECompanyPermission,
  EDayOfWeek,
  EListingStates,
  EMenuMealType,
  EMenuType,
  EUserRole,
} from '@src/utils/enums';
import type { ChecklistImage } from '@src/utils/types';

import type { Assert, DeepPartial, Image, ListingBuilder } from './utils';

export type FoodListing = ListingBuilder<
  {},
  {
    allergicIngredients: string[];
    category: string;
    foodType: string;
    maxQuantity: number;
    menuIdList: string[];
    menuType: string;
    menuWeekDay: string[];
    minOrderHourInAdvance: number;
    minQuantity: number;
    numberOfMainDishes: string;
    packaging: string;
    sideDishes: string[];
    unit: string;
  },
  {
    adminApproval: string;
    isDraft: boolean;
    isFoodEnable: boolean;
    listingType: string;
    restaurantId: string;
  },
  {},
  { images: Image[] }
>;

export type RestaurantListing = ListingBuilder<
  {},
  {
    location: {
      address: string;
    };
    foodCertificate: {
      status: 'no' | 'yes';
    };
    businessLicense: {
      status: 'no' | 'yes';
    };
    contactorName: string;
    minPrice: number;
    packaging: string[];
    vat: 'vat' | 'noExportVat' | 'direct';
    phoneNumber: string;
  },
  {
    status: 'unsatisfactory' | 'authorized' | 'new';
  },
  {
    summary: {
      totalOrders: number;
      totalRevenue: number;
      firstOrderBookedAt: number;
      lastUpdatedAt: number;
    };
  },
  {}
>;

type QuotationListingRecord = Record<
  string,
  {
    name: string;
    quotation: Record<
      string,
      {
        foodId: string;
        foodName: string;
        foodPrice: number;
        foodUnit: string;
        frequency: number;
      }[]
    >;
  }
>;

export type QuotationListing = ListingBuilder<
  {},
  {},
  {
    orderId: string;
    companyId: string;
    listingType: 'quotation';
    client: QuotationListingRecord;
    partner: QuotationListingRecord;
    status: 'active';
    mealItemsFailed?: MealItemsFailedQuotation;
  },
  {},
  {}
>;

export type OrderListing = ListingBuilder<
  {},
  {
    companyName: string;
    orderName: string;
  },
  {
    bookerId: string;
    companyId: string;
    companyName: string;
    dayInWeek: string[];
    daySession: string;
    deadlineDate: number;
    deadlineHour: string;
    deliveryAddress: {
      address: string;
      origin: {
        lat: number;
        lng: number;
      };
    };
    deliveryHour: string;
    endDate: number;
    isAutoPickFood: boolean;
    listingType: string;
    mealType: string[];
    memberAmount: number;
    menuIds: string[];
    nutritions: string[];
    orderState: string;
    orderStateHistory: { state: string; updatedAt: number }[];
    orderType: string;
    packagePerMember: number;
    participants: string[];
    plans: string[];
    quotationId: string;
    selectedGroups: string[];
    serviceFees: Record<string, number>;
    startDate: number;
    ratings: RatingListingMetadata[];
  },
  {},
  {}
>;

export type MemberOrderValue = {
  foodId: string;
  secondaryFoodId?: string;
  secondaryRequirement?: string;
  requirement: string;
  status: 'empty' | 'joined' | 'notJoined' | 'notAllowed' | 'expired';
  barcode?: string;
};

export type MealItemsFailedItem = {
  memberId: string;
  foodId: string;
  reason: string;
};

export type MealItemsFailedQuotationItem = {
  foodId: string;
  count: number;
};

export type MealItemsFailed = Record<string, MealItemsFailedItem[]>;

export type MealItemsFailedQuotation = Record<
  string,
  MealItemsFailedQuotationItem[]
>;

export type OrderDetailValue = {
  hasNoRestaurants: boolean;
  lineItems: {
    id: string;
    name: string;
    price: number;
    quantity: number;
    unitPrice: number;
  }[];
  transactionId: string;
  lastTransition: string;
  trackingLink?: string;
  memberOrders: Record<string, MemberOrderValue>;
  restaurant: {
    foodList: Record<
      string,
      {
        foodName: string;
        foodPrice: number;
        foodUnit: string;
      }
    >;
    id: string;
    maxQuantity: number;
    menuId: string;
    minQuantity: number;
    phoneNumber: string;
    restaurantName: string;
  };
  editTagVersion?: number;
  oldValues?: OrderDetailValue[];
};

export interface DeliveryInfoImage {
  imageUrl: string;
  imageId: string;
  uploadedAt: number;
  lastTransition: string;
}

export type PlanListing = ListingBuilder<
  {},
  {},
  {
    listingType: string;
    menuIds: string[];
    orderDetail: { [timestamp: string]: OrderDetailValue };
    deliveryAgentsMeals: {
      [timestamp: string]: {
        restaurantId: string;
        restaurantName: string;
        numberOfMeals: number;
      };
    };
    orderDetailStartedSnapshot: { [timestamp: string]: OrderDetailValue };
    barcodeHashMap: Record<string, string>;
    orderId: string;
    partnerIds: string[];
    planStarted: boolean;
    slackThreadTs: string;
    allowToScan?: boolean;
    allowToQRCode?: boolean;
    deliveryInfoLastUpdatedAtTimestamp?: number;
    deliveryInfo?: Record<
      string,
      Record<
        string,
        {
          images: DeliveryInfoImage[];
        }
      >
    >;
    mealItemsFailed?: MealItemsFailed;
  },
  {},
  {}
>;

export type UserListing = DeepPartial<{
  id: {
    _sdkType: string;
    uuid: string;
  };
  type: string;
  attributes: {
    deleted: boolean;
    banned: boolean;
    email: string;
    createdAt: string;
    state: string;
    identityProviders: unknown[];
    pendingEmail: unknown;
    emailVerified: boolean;
    profile: {
      displayName: string;
      firstName: string;
      privateData: {
        hasOrderBefore: boolean;
        oneSignalUserIds: string[];
        quizData: {
          daySession: string;
          deliveryHour: string;
          mealStyles: unknown[];
          mealType: unknown[];
          memberAmount: number;
          nutritions: unknown[];
          packagePerMember: number;
        };
        subAccountId: string;
        tax: string;
      };
      protectedData: {};
      bio: unknown;
      abbreviatedName: string;
      lastName: string;
      publicData: {
        companyEmail: string;
        companyLocation: {
          address: string;
          origin: {
            lat: number;
            lng: number;
          };
        };
        companyName: string;
        isAutoPickFood: boolean;
        location: {
          address: string;
          origin: {
            lat: number;
            lng: number;
          };
        };
        phoneNumber: string;
      };
      metadata: {
        company: {
          [key: string]: {
            permission: ECompanyPermission;
          };
        };
        isPartner: boolean;
        companyList: string[];
        groups: {
          id: string;
          members: {
            email: string;
            id: string;
          }[];
          name: string;
        }[];
        hasSpecificPCCFee: boolean;
        id: string;
        isCompany: boolean;
        isAdmin: boolean;
        restaurantListingId?: string;
        isOnBoardingEmailSent: boolean;
        members: {
          [key: string]: {
            email: string;
            groups: string[];
            id: string;
            inviteStatus: 'accepted' | 'declined';
            permission: 'booker' | 'participant' | 'owner';
          };
        };
        previousKeywords: string[];
        userState: string;
        walkthroughEnable: boolean;
      };
    };
  };
  profileImage: Image;
}>;

export type FlexDSKMeta = {
  page: number;
  perPage: number;
  paginationUnsupported?: boolean;
  totalItems: number;
  totalPages: number;
};

export type WithFlexSDKData<T> = {
  status: number;
  statusText: string;
  data: {
    data: T;
    meta?: FlexDSKMeta;
    included?: Image[];
  };
};

export type OrderDetail = Assert<
  Assert<Assert<PlanListing['attributes']>['metadata']>['orderDetail']
>;

export interface RatingListingMetadata {
  detailRating: {
    food: {
      rating: number;
    };
    packaging: {
      rating: number;
    };
  };
  detailTextRating: string;
  foodId: string;
  foodName: string;
  generalRating: number;
  companyId: string;
  orderId: string;
  orderCode: string;
  restaurantId: string;
  reviewRole: 'participant' | 'booker';
  reviewerId: string;
  timestamp: number;
  replies?: TReviewReply[];
  generalRatingValue: number[];
  slackThreadTs?: string;
  secondaryFoodName?: string;
  secondaryFoodId?: string;
}

export type RatingListing = ListingBuilder<
  {},
  {},
  RatingListingMetadata,
  {},
  {
    images?: Image[];
    author?: UserListing;
  }
>;

export type ParticipantSubOrderDocument = DeepPartial<{
  deliveryHour: string;
  txStatus: 'delivered';
  createdAt: {
    seconds: number;
    nanoseconds: number;
  };
  restaurantName: string;
  status: 'joined';
  orderId: string;
  restaurantAvatarImage: Image;
  restaurantId: string;
  planId: string;
  reviewId: string;
  foodId: string;
  participantId: string;
  id: string;
}>;

export type TReviewReplyStatus = 'pending' | 'approved' | 'rejected';

export type TReviewReply = {
  id?: string;
  authorId: string;
  authorName: string;
  replyRole: EUserRole;
  replyContent: string;
  repliedAt: number;
  status?: TReviewReplyStatus;
  approvedAt?: number;
  approvedBy?: string;
};

// Menu Listing Types
export type TMenuFoodItem = {
  id: string;
  title: string;
  price: number;
  foodNote: string;
  sideDishes: string[];
  nutritionsList: string[];
};

export type TMenuPublicData = {
  daysOfWeek: EDayOfWeek[];
  endDate: number;
  foodsByDate: Record<EDayOfWeek, Record<string, TMenuFoodItem>>;
  mealType: EMenuMealType;
  menuType: EMenuType;
  numberOfCycles: number;
  startDate: number;
  monMinFoodPrice?: number;
  tueMinFoodPrice?: number;
  wedMinFoodPrice?: number;
  thuMinFoodPrice?: number;
  friMinFoodPrice?: number;
  satMinFoodPrice?: number;
  sunMinFoodPrice?: number;
};

export type TMenuMetadata = {
  authorId: string;
  restaurantId: string;
  listingState: EListingStates;
  menuType: EMenuType;
  listingType: 'menu';
  geolocation: {
    lat: number;
    lng: number;
  };
  monFoodIdList?: string[];
  tueFoodIdList?: string[];
  wedFoodIdList?: string[];
  thuFoodIdList?: string[];
  friFoodIdList?: string[];
  satFoodIdList?: string[];
  sunFoodIdList?: string[];
  monFoodType?: string[];
  tueFoodType?: string[];
  wedFoodType?: string[];
  thuFoodType?: string[];
  friFoodType?: string[];
  satFoodType?: string[];
  sunFoodType?: string[];
  monNutritions?: string[];
  tueNutritions?: string[];
  wedNutritions?: string[];
  thuNutritions?: string[];
  friNutritions?: string[];
  satNutritions?: string[];
  sunNutritions?: string[];
};

export type MenuListing = ListingBuilder<
  {},
  TMenuPublicData,
  TMenuMetadata,
  {},
  {}
>;

export type TQueryParams = {
  page: number;
  perPage: number;
};

export type ChecklistMetadata = {
  listingType: 'checklist';
  orderId: string;
  subOrderDate: string;
  implementationDate: string;
  recordedTime: string;
  responsibleStaffName: string;
  clientName: string;
  orderCode: string;
  partnerName: string;
  foodTakenOutTime: string;
  foodSafetyTime: string;
  qaQcSignature: string;
  qaQcName: string;
  partnerSignature?: string;
  partnerNameSignature?: string;
  clientSignature?: string;
  clientNameSignature?: string;
  images?: ChecklistImage[];
};

export type ChecklistListing = ListingBuilder<
  {},
  {},
  ChecklistMetadata,
  {},
  {
    images?: Image[];
    author?: UserListing;
  }
>;
