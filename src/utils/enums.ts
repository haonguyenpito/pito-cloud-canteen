import { EBadgeType } from '@components/Badge/Badge';

export enum EImageVariants {
  default = 'default',
  landscapeCrop = 'landscape-crop',
  landscapeCrop2x = 'landscape-crop2x',
  landscapeCrop4x = 'landscape-crop4x',
  landscapeCrop6x = 'landscape-crop6x',
  scaledSmall = 'scaled-small',
  scaledMedium = 'scaled-medium',
  scaledLarge = 'scaled-large',
  scaledXLarge = 'scaled-xlarge',
  squareSmall = 'square-small',
  squareSmall2x = 'square-small2x',
  squareXsSmall = 'square-xsmall',
  squareXsSmall2x = 'square-xsmall2x',
  facebook = 'facebook',
  twitter = 'twitter',
}

export enum EListingMenuStates {
  draft = 'draft',
  pendingRestaurantApproval = 'pendingRestaurantApproval',
  published = 'published',
  closed = 'closed',
}

export enum EListingStates {
  rejected = 'rejected',
  draft = 'draft',
  pendingApproval = 'pendingApproval',
  published = 'published',
  closed = 'closed',
}

export enum EAvailabilityPlans {
  day = 'availability-plan/day',
  time = 'availability-plan/time',
}

export enum EDayOfWeek {
  mon = 'mon',
  tue = 'tue',
  wed = 'wed',
  thu = 'thu',
  fri = 'fri',
  sat = 'sat',
  sun = 'sun',
}

export const DAY_OF_WEEK_PRIORITIES = {
  [EDayOfWeek.mon]: 0,
  [EDayOfWeek.tue]: 1,
  [EDayOfWeek.wed]: 2,
  [EDayOfWeek.thu]: 3,
  [EDayOfWeek.fri]: 4,
  [EDayOfWeek.sat]: 5,
  [EDayOfWeek.sun]: 6,
};

export enum EBookingStates {
  pending = 'pending',
  accepted = 'accepted',
  cancelled = 'cancelled',
  declined = 'declined',
}

export enum ETimeSlots {
  day = 'time-slot/day',
  time = 'time-slot/time',
}

export enum ETxTransitionActors {
  customer = 'customer',
  provider = 'provider',
  system = 'system',
  operator = 'operator',
}

export enum EReviewRatings {
  one = 1,
  two = 2,
  three = 3,
  four = 4,
  five = 5,
}

export enum EReviewType {
  ofProvider = 'ofProvider',
  ofCustomer = 'ofCustomer',
}

export enum ETransactionRoles {
  provider = 'provider',
  customer = 'customer',
  operator = 'operator',
}

export enum EErrorCode {
  transactionListingNotFound = 'transaction-listing-not-found',
  transactionInvalidTransition = 'transaction-invalid-transition',
  transactionAlreadyReviewedByCustomer = 'transaction-already-reviewed-by-customer',
  transactionAlreadyReviewedByProvider = 'transaction-already-reviewed-by-provider',
  transactionBookingTimeNotAvailable = 'transaction-booking-time-not-available',
  paymentFailed = 'transaction-payment-failed',
  chargeZeroPayin = 'transaction-charge-zero-payin',
  chargeZeroPayout = 'transaction-charge-zero-payout',
  emailTaken = 'email-taken',
  emailNotFound = 'email-not-found',
  tooManyVerificationRequests = 'email-too-many-verification-requests',
  uploadOverLimit = 'request-upload-over-limit',
  validationInvalidParams = 'validation-invalid-params',
  validationInValidValue = 'validation-invalid-value',
  notFound = 'not-found',
  forbidden = 'forbidden',
  missingStripeAccount = 'transaction-missing-stripe-account',
  newOwnerAlreadyACompanyUser = 'new-owner-already-a-company-user',
  bookerInOrderProgress = 'booker-in-order-progress',
}

export enum ECompanyStatus {
  active = 1,
  unactive = 0,
}

export enum ECompanyStates {
  draft = 'draft',
  published = 'published',
  unactive = 'unactive',
}

export enum EListingType {
  restaurant = 'restaurant',
  food = 'food',
  menu = 'menu',
  subOrder = 'sub-order',
  order = 'order',
  rating = 'rating',
  quotation = 'quotation',
  log = 'log',
  checklist = 'checklist',
}

export enum EOrderType {
  normal = 'normal',
  group = 'group',
}

export enum EUserSystemPermission {
  normal = 'normal',
  admin = 'admin',
  company = 'company',
  partner = 'partner',
}

export enum EUserRole {
  admin = 'admin',
  company = 'company',
  partner = 'partner',
  booker = 'booker',
  participant = 'participant',
}

export enum ECompanyPermission {
  owner = 'owner',
  booker = 'booker',
  participant = 'participant',
  accountant = 'accountant',
}

export enum ERestaurantListingStatus {
  new = 'new',
  authorized = 'authorized',
  unsatisfactory = 'unsatisfactory',
}

export enum EInvalidRestaurantCase {
  closed = 'closed',
  noMenusValid = 'noMenusValid',
  stopReceiveOrder = 'stopReceiveOrder',
}

export enum EParticipantOrderStatus {
  empty = 'empty',
  joined = 'joined',
  notJoined = 'notJoined',
  notAllowed = 'notAllowed',
  expired = 'expired',
}

export const EPackagingMaterials = {
  PAPER_BOX: 'paper-box',
  PLASTIC_BOX: 'plastic-box',
  BAGASSE_BOX: 'bagasse-box',
  PLASTIC_STYROFOAM: 'plastic-styrofoam',
  HEAT_RETAINING_ALUMINUM_XBOX: 'heat-retaining-aluminum-xbox',
  DEGRADABLE_PLASTIC: 'degradable-plastic',
  REUSABLE_BOX: 'reusable-box',
};

export enum EMenuType {
  fixedMenu = 'fixed-menu',
  cycleMenu = 'cycle-menu',
}

export enum EOrderStates {
  canceled = 'canceled',
  canceledByBooker = 'canceledByBooker',
  picking = 'picking',
  inProgress = 'inProgress',
  pendingPayment = 'pendingPayment',
  completed = 'completed',
  reviewed = 'reviewed',
  expiredStart = 'expiredStart',
}

export enum EBookerOrderDraftStates {
  bookerDraft = 'bookerDraft',
}
export enum EOrderDraftStates {
  draft = 'draft',
  pendingApproval = 'pendingApproval',
}

export enum EFoodType {
  vegetarianDish = 'vegetarian-dish',
  savoryDish = 'savory-dish',
}

export enum EOrderDetailsStatus {
  received = 'received',
  delivered = 'delivered',
  cancelled = 'cancelled',
  pending = 'pending',
}

export enum EMenuMealType {
  breakfast = 'breakfast',
  lunch = 'lunch',
  dinner = 'dinner',
  snack = 'snack',
}

export enum EManageCompanyOrdersTab {
  ALL = 'all',
  SCHEDULED = 'scheduled',
  COMPLETED = 'completed',
  DRAFT = 'draft',
  CANCELED = 'canceled',
}

export const MANAGE_COMPANY_ORDERS_TAB_MAP = {
  [EManageCompanyOrdersTab.ALL]: [
    EOrderDraftStates.pendingApproval,
    EBookerOrderDraftStates.bookerDraft,
    EOrderStates.picking,
    EOrderStates.inProgress,
    EOrderStates.pendingPayment,
    EOrderStates.completed,
    EOrderStates.reviewed,
    EOrderStates.canceled,
    EOrderStates.expiredStart,
  ],
  [EManageCompanyOrdersTab.SCHEDULED]: [
    EOrderStates.picking,
    EOrderStates.inProgress,
  ],
  [EManageCompanyOrdersTab.COMPLETED]: [
    EOrderStates.completed,
    EOrderStates.reviewed,
    EOrderStates.pendingPayment,
  ],
  [EManageCompanyOrdersTab.DRAFT]: [
    EOrderDraftStates.pendingApproval,
    EBookerOrderDraftStates.bookerDraft,
  ],
  [EManageCompanyOrdersTab.CANCELED]: [
    EOrderStates.canceled,
    EOrderStates.expiredStart,
  ],
};

export enum EAttributeSetting {
  MEAL_STYLES = 'mealStyles',
  NUTRITIONS = 'nutritions',
  DAY_SESSIONS = 'daySessions',
  PACKAGING = 'packaging',
}

export enum ECompanyDashboardNotificationType {
  draftOrder = 'draftOrder',
  completedOrder = 'completedOrder',
  deadlineDueOrder = 'deadlineDueOrder',
  pickingOrder = 'pickingOrder',
}

export enum EOrderDetailTabs {
  ORDER_DETAIL = 'orderDetail',
  QUOTATION = 'quotation',
  PAYMENT_STATUS = 'paymentStatus',
  CHANGE_HISTORY = 'changeHistory',
  REVIEW = 'review',
  CONTRACT = 'contract',
  VAT = 'vat',
}

export enum ESubOrderTxStatus {
  DELIVERING = 'delivering',
  DELIVERED = 'delivered',
  PENDING = 'pending',
  CANCELED = 'canceled',
}

export enum ESubOrderStatus {
  canceled = 'canceled',
  inProgress = 'inProgress',
  delivered = 'delivered',
  delivering = 'delivering',
}

export enum EEditOrderHistoryType {
  addFood = 'ADD_FOOD',
  deleteFood = 'DELETE_FOOD',
  changeRestaurant = 'CHANGE_RESTAURANT',
  changePCCFee = 'CHANGE_PCC_FEE',
  changeShipperName = 'CHANGE_SHIPPER_NAME',
  changeStaffName = 'CHANGE_STAFF_NAME',
}

export enum EEditSubOrderHistoryType {
  MEMBER_FOOD_CHANGED = 'MEMBER_FOOD_CHANGED',
  MEMBER_FOOD_REMOVED = 'MEMBER_FOOD_REMOVED',
  MEMBER_FOOD_ADDED = 'MEMBER_FOOD_ADDED',
  MEMBERS_FOOD_RESTORED = 'MEMBERS_FOOD_RESTORED',
  FOOD_ADDED = 'FOOD_ADDED',
  FOOD_REMOVED = 'FOOD_REMOVED',
  FOOD_INCREASED = 'FOOD_INCREASED',
  FOOD_DECREASED = 'FOOD_DECREASED',
}

export enum EQuotationStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export enum ENotificationType {
  INVITATION = 'INVITATION',
  COMPANY_JOINED = 'COMPANY_JOINED',
  ORDER_SUCCESS = 'ORDER_SUCCESS',
  ORDER_CANCEL = 'ORDER_CANCEL',
  ORDER_DELIVERING = 'ORDER_DELIVERING',
  ORDER_PICKING = 'ORDER_PICKING',
  ORDER_RATING = 'ORDER_RATING',

  SUB_ORDER_UPDATED = 'SUB_ORDER_UPDATED',
  SUB_ORDER_INPROGRESS = 'SUB_ORDER_INPROGRESS',
  SUB_ORDER_CANCELED = 'SUB_ORDER_CANCELED',
  SUB_ORDER_DELIVERED = 'SUB_ORDER_DELIVERED',
  SUB_ORDER_DELIVERING = 'SUB_ORDER_DELIVERING',
  SUB_ORDER_REVIEWED_BY_BOOKER = 'SUB_ORDER_REVIEWED_BY_BOOKER',
  SUB_ORDER_REVIEWED_BY_PARTICIPANT = 'SUB_ORDER_REVIEWED_BY_PARTICIPANT',
  PARTNER_MENU_CREATED_BY_ADMIN = 'PARTNER_MENU_CREATED_BY_ADMIN',
  PARTNER_FOOD_CREATED_BY_ADMIN = 'PARTNER_FOOD_CREATED_BY_ADMIN',
  PARTNER_PROFILE_UPDATED_BY_ADMIN = 'PARTNER_PROFILE_UPDATED_BY_ADMIN',
  PARTNER_FOOD_ACCEPTED_BY_ADMIN = 'PARTNER_FOOD_ACCEPTED_BY_ADMIN',
  PARTNER_FOOD_REJECTED_BY_ADMIN = 'PARTNER_FOOD_REJECTED_BY_ADMIN',
  PARTNER_MENU_APPROVED_BY_ADMIN = 'PARTNER_MENU_APPROVED_BY_ADMIN',
  PARTNER_MENU_REJECTED_BY_ADMIN = 'PARTNER_MENU_REJECTED_BY_ADMIN',
  PARTNER_SUB_ORDER_CHANGED = 'PARTNER_SUB_ORDER_CHANGED',

  BOOKER_NEW_ORDER_CREATED = 'BOOKER_NEW_ORDER_CREATED',
  BOOKER_SUB_ORDER_COMPLETED = 'BOOKER_SUB_ORDER_COMPLETED',
  BOOKER_SUB_ORDER_CANCELLED = 'BOOKER_SUB_ORDER_CANCELLED',
  BOOKER_ORDER_CHANGED = 'BOOKER_ORDER_CHANGED',
  BOOKER_RATE_ORDER = 'BOOKER_RATE_ORDER',
  BOOKER_PICKING_ORDER = 'BOOKER_PICKING_ORDER',

  ADMIN_REPLY_REVIEW = 'ADMIN_REPLY_REVIEW',
  ADMIN_APPROVE_PARTNER_REPLY_REVIEW = 'ADMIN_APPROVE_PARTNER_REPLY_REVIEW',
  PARTNER_REPLY_REVIEW = 'PARTNER_REPLY_REVIEW',
}
export enum ENotificationPopupType {
  success = 'success',
  warning = 'warning',
  error = 'error',
}

export enum EFirebasePaymentStatus {
  SUCCESS = 'success',
}

export enum EPaymentType {
  PARTNER = 'partner',
  CLIENT = 'client',
}

export enum EPartnerVATSetting {
  vat = 'vat',
  noExportVat = 'noExportVat',
  direct = 'direct',
}

export enum EOrderPaymentStatus {
  isPaid = 'isPaid',
  isNotPaid = 'isNotPaid',
}

export const CONFIGS_BASE_ON_PAYMENT_STATUS = {
  [EOrderPaymentStatus.isPaid]: {
    label: 'Đã thanh toán',
    badgeType: EBadgeType.success,
  },
  [EOrderPaymentStatus.isNotPaid]: {
    label: 'Chưa thanh toán',
    badgeType: EBadgeType.warning,
  },
};

export enum ENativeNotificationType {
  BookerTransitOrderStateToPicking = 'BookerTransitOrderStateToPicking',
  BookerTransitOrderStateToInProgress = 'BookerTransitOrderStateToInProgress',
  AdminTransitSubOrderToDelivered = 'AdminTransitSubOrderToDelivered',
  AdminTransitSubOrderToCanceled = 'AdminTransitSubOrderToCanceled',
  TransitOrderStateToCanceled = 'TransitOrderStateToCanceled',
  AdminTransitFoodStateToApprove = 'AdminTransitFoodStateToApprove',
  AdminTransitFoodStateToReject = 'AdminTransitFoodStateToReject',
  AdminUpdateOrder = 'AdminUpdateOrder',
  AdminChangePartnerInformation = 'AdminChangePartnerInformation',
  PartnerTransitOrderToCanceled = 'PartnerTransitOrderToCanceled',
  PartnerEditSubOrder = 'PartnerEditSubOrder',
  PartnerSubOrderNegativeRating = 'PartnerSubOrderNegativeRating',
  AdminReplyReview = 'AdminReplyReview',
  AdminApprovePartnerReplyReview = 'AdminApprovePartnerReplyReview',
  AdminApprovePartnerMenu = 'AdminApprovePartnerMenu',
  AdminRejectPartnerMenu = 'AdminRejectPartnerMenu',
  Events = 'Events',
}

export enum EBookerNativeNotificationType {
  AdminCreateNewOrder = 'AdminCreateNewOrder',
  AdminStartOrder = 'AdminStartOrder',
  RemindBeforeDeadline = 'RemindBeforeDeadline',
  SubOrderCancelled = 'SubOrderCancelled',
  SubOrderDelivered = 'SubOrderDelivered',
  SubOrderDelivering = 'SubOrderDelivering',
  OrderIsPendingPayment = 'OrderIsPendingPayment',
}

export enum EFoodApprovalState {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
}

export const FOOD_APPROVAL_STATE_OPTIONS = [
  {
    key: EFoodApprovalState.PENDING,
    label: 'Chờ duyệt',
  },
  {
    key: EFoodApprovalState.ACCEPTED,
    label: 'Đã duyệt',
  },
  {
    key: EFoodApprovalState.DECLINED,
    label: 'Từ chối',
  },
];

export enum ESlackNotificationType {
  CREATE_NEW_FOOD = 'createNewFood',
  UPDATE_FOOD = 'updateFood',
  ORDER_STATUS_CHANGES_TO_IN_PROGRESS = 'orderStatusChangesToInProgress',
  DELIVERY_AGENT_IMAGES_UPLOADED = 'deliveryAgentImagesUploaded',
  PARTICIPANT_GROUP_ORDER_FOOD_CHANGED = 'participantGroupOrderFoodChanged',
  PARTICIPANT_NORMAL_ORDER_FOOD_CHANGED = 'participantNormalOrderFoodChanged',
  SUB_ORDER_CANCELED = 'subOrderCanceled',
  RESTAURANT_CHANGED = 'restaurantChanged',
  PARTNER_CONFIRMS_SUB_ORDER = 'partnerConfirmsSubOrder',
  PARTNER_REJECTS_SUB_ORDER = 'partnerRejectsSubOrder',
  PARTICIPANT_RATING = 'participantRating',
  PARTICIPANT_ORDER_PERSISTENCE_FAILED = 'participantOrderPersistenceFailed',
  PARTNER_REPLY_REVIEW = 'partnerReplyReview',
  ADMIN_REPLY_REVIEW = 'adminReplyReview',
  ADMIN_APPROVE_PARTNER_REPLY_REVIEW = 'adminApprovePartnerReplyReview',
  PARTNER_MENU_PUBLISHED_DRAFT_TO_PENDING = 'partnerMenuPublishedDraftToPending',
  ADMIN_APPROVE_PARTNER_MENU = 'adminApprovePartnerMenu',
  ADMIN_REJECT_PARTNER_MENU = 'adminRejectPartnerMenu',
  PARTICIPANT_PLACE_ORDER_FAILED = 'participantPlaceOrderFailed',
}

export enum QuizStep {
  NEW_ORDER = 'new',
  PACKAGE_PER_MEMBER = 'perpack-member-amount',
  SPECIAL_DEMAND = 'special-demand',
  MEAL_STYLES = 'meal-styles',
  MEAL_DATE = 'meal-date',
  INVITE_MEMBER = 'invite-member',
  ORDER_CREATING = 'order-creating',
}

export enum EOnWheelOrderStatus {
  idle = 'IDLE',
  inProcess = 'IN PROCESS',
  cancelled = 'CANCELLED',
  completed = 'COMPLETED',
  accepted = 'ACCEPTED',
  assigning = 'ASSIGNING',
}

export enum EFluctuationType {
  INCREASE = 'increase',
  DECREASE = 'decrease',
  EQUAL = 'equal',
}

export enum ETimeFrame {
  MONTH = 'month',
  WEEK = 'week',
  DAY = 'day',
}

export enum ETimePeriodOption {
  TODAY = 'today',
  YESTERDAY = 'yesterday',
  LAST_WEEK = 'lastWeek',
  LAST_MONTH = 'lastMonth',
  LAST_7_DAYS = 'last7Days',
  LAST_30_DAYS = 'last30Days',
  CUSTOM = 'custom',
}

export enum EAppLocale {
  VI = 'vi',
  EN = 'en',
}

export enum EPartnerReply {
  pending = 'pending',
  approved = 'approved',
  rejected = 'rejected',
}
