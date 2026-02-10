export const generalPaths = {
  SignIn: '/dang-nhap',
  SignUp: '/dang-ky',
  RecoveryPassword: '/quen-mat-khau',
  ResetPassword: '/dat-lai-mat-khau',
  StyleGuide: '/style-guide',
  EmailVerification: '/xac-nhan-email',
  Home: '/',
};

export const websitePaths = {
  MealBoxDelivery: '/meal-box-delivery',
  PopupCanteen: '/popup-canteen',
  SmallBusiness: '/solutions/small-business',
  MiddleBusiness: '/solutions/middle-business',
  Admin: '/solutions/admin',
  Employee: '/solutions/employees',
  Startup: '/solutions/start-up',
  TechService: '/solutions/tech-service',
  OffShore: '/off-shore',
};

export const viWebsitePaths = {
  MealBoxDelivery: '/giao-nhan-com-trua-van-phong',
  PopupCanteen: '/popup-canteen',
  SmallBusiness: '/giai-phap/doanh-nghiep-nho',
  MiddleBusiness: '/giai-phap/doanh-nghiep-vua',
  Admin: '/giai-phap/admin',
  Employee: '/giai-phap/employees',
  Startup: '/giai-phap/start-up',
  TechService: '/giai-phap/cong-ty-cong-nghe',
  OffShore: '/off-shore',
};

export const publicPaths = [
  websitePaths.MealBoxDelivery,
  websitePaths.PopupCanteen,
  websitePaths.SmallBusiness,
  websitePaths.MiddleBusiness,
  websitePaths.Admin,
  websitePaths.Employee,
  websitePaths.Startup,
  websitePaths.TechService,
  '/website',
  '/sitemap.xml',
  '/robots.txt',
];

export const enGeneralPaths = {
  SignIn: '/sign-in',
  SignUp: '/sign-up',
  RecoveryPassword: '/forgot-password',
  ResetPassword: '/reset-password',
  StyleGuide: '/style-guide',
  EmailVerification: '/verify-email',
  Auth: '/auth',
  Tracking: '/tracking/[subOrderId]',
  QRCode: '/qrcode',
  SentryExamplePage: '/sentry-example-page',
  getInvitationPath: (orderId: string) => `/invitation/${orderId}`,
  login: {
    index: '/dang-nhap/',
  },
  auth: {
    index: '/auth',
  },
  admin: {
    scanner: {
      '[planId]': {
        '[timestamp]': {
          index: (planId: string, timestamp: string) =>
            `/admin/scanner/${planId}/${timestamp}`,
        },
      },
    },
    order: {
      '[orderId]': {
        index: (orderId: string) => `/admin/order/${orderId}`,
        checklist: (orderId: string) => `/admin/order/${orderId}/checklist`,
      },
    },
  },
  company: {
    orders: {
      '[orderId]': {
        index: (orderId: string) => `/company/orders/${orderId}`,
      },
    },
    '[companyId]': {
      ratings: {
        index: (companyId: string) => `/company/${companyId}/ratings`,
      },
    },
    booker: {
      orders: {
        new: {
          '[companyId]': {
            index: (companyId: string) =>
              `/company/booker/orders/new/${companyId}`,
          },
        },
      },
    },
  },
  partner: {
    scanner: {
      '[planId]': {
        '[timestamp]': {
          index: (planId: string, timestamp: string) =>
            `/partner/scanner/${planId}/${timestamp}`,
        },
      },
    },
  },
};

export const personalPaths = {
  Account: '/company/personal/account',
  Info: '/company/personal/account/info',
  Nutrition: '/company/personal/nutrition',
  Members: '/company/personal/members',
  GroupList: '/company/personal/group-setting',
  ChangePassword: '/company/personal/account/change-password',
};

export const NonRequireAuthenticationRoutes = [
  generalPaths.RecoveryPassword,
  generalPaths.ResetPassword,
  generalPaths.SignIn,
  generalPaths.SignUp,
  enGeneralPaths.RecoveryPassword,
  enGeneralPaths.ResetPassword,
  enGeneralPaths.SignIn,
  enGeneralPaths.SignUp,
  enGeneralPaths.SentryExamplePage,
];

export const IgnoredAuthCheckRoutes = [
  generalPaths.StyleGuide,
  generalPaths.RecoveryPassword,
  enGeneralPaths.RecoveryPassword,
  generalPaths.ResetPassword,
  enGeneralPaths.ResetPassword,
  enGeneralPaths.Tracking,
  enGeneralPaths.SentryExamplePage,
];
export const IgnoredPermissionCheckRoutes = [
  generalPaths.SignIn,
  generalPaths.SignUp,
  generalPaths.RecoveryPassword,
  generalPaths.StyleGuide,
  generalPaths.ResetPassword,
  enGeneralPaths.SignIn,
  enGeneralPaths.SignUp,
  enGeneralPaths.RecoveryPassword,
  enGeneralPaths.ResetPassword,
  generalPaths.EmailVerification,
  enGeneralPaths.EmailVerification,
  enGeneralPaths.Tracking,
  enGeneralPaths.QRCode,
  enGeneralPaths.SentryExamplePage,
  enGeneralPaths.getInvitationPath('[orderId]'),
];

export const adminPaths = {
  Dashboard: '/admin',
  ManageUsers: '/admin/users',
  ManageCompanies: '/admin/company',
  EditCompany: '/admin/company/[companyId]/edit',
  CreateCompany: '/admin/company/create',
  ManagePartners: '/admin/partner',
  CreatePartner: '/admin/partner/create',
  EditPartner: '/admin/partner/[partnerId]/edit',
  ManageOrders: '/admin/order',
  CreateOrder: '/admin/order/create',
  UpdateDraftOrder: '/admin/order/create/[orderId]',
  EditOrder: '/admin/order/edit/[orderId]',
  OrderDetail: '/admin/order/[orderId]',
  Checklist: '/admin/order/[orderId]/checklist/[subOrderDate]',
  ManageReviews: '/admin/reviews',
};

// Should be an object => path should has its label
export const adminRoutes = {
  Dashboard: {
    path: '/admin',
    label: 'Trang chủ',
  },
  ManageUsers: {
    path: '/admin/users',
    label: 'Quản lý người dùng',
  },
  ManageCompanies: {
    path: '/admin/company',
    label: 'Quản lý khách hàng',
  },
  EditCompany: {
    path: '/admin/company/[companyId]/edit',
    label: 'Chỉnh sửa',
  },
  CompanyDetails: {
    path: '/admin/company/[companyId]',
    label: 'Thông tin khách hàng',
  },
  CreateCompany: {
    path: '/admin/company/create',
    label: 'Tạo khách hàng',
  },
  ManagePartners: {
    path: '/admin/partner',
    label: 'Quản lý đối tác',
  },
  CreatePartner: {
    path: '/admin/partner/create',
    label: 'Tạo đối tác',
  },
  EditPartner: {
    path: '/admin/partner/[restaurantId]/edit',
    label: 'Chỉnh sửa',
  },
  PartnerDetails: {
    path: '/admin/partner/[restaurantId]',
    label: 'Thông tin đối tác',
  },
  ManageOrders: {
    path: '/admin/order',
    label: 'Quản lý đơn hàng',
  },
  CreateOrder: {
    path: '/admin/order/create',
    label: 'Tạo đơn hàng',
  },
  OrderDetails: {
    path: '/admin/order/[orderId]',
    label: 'Chi tiết đơn hàng',
  },
  PartnerSettings: {
    path: '/admin/partner/[restaurantId]/settings',
    label: 'Cài đặt nhà hàng',
  },
  ManagePartnerFoods: {
    path: '/admin/partner/[restaurantId]/settings/food',
    label: 'Danh sách món ăn',
  },
  CreatePartnerFood: {
    path: '/admin/partner/[restaurantId]/settings/food/create',
    label: 'Tạo món ăn',
  },
  EditPartnerFood: {
    path: '/admin/partner/[restaurantId]/settings/food/[foodId]',
    label: 'Chỉnh sửa món ăn',
  },
  ManagePartnerMenus: {
    path: '/admin/partner/[restaurantId]/settings/menu',
    label: 'Thực đơn',
  },
  ManagePartnersMenus: {
    path: '/admin/partner/pending-menus',
    label: 'Quản lý thực đơn đối tác',
  },
  ManagePartnerFixedMenus: {
    path: '/admin/partner/[restaurantId]/settings/menu/fixed-menu',
    label: 'Thực đơn cố định',
  },
  ManagePartnerCycleMenus: {
    path: '/admin/partner/[restaurantId]/settings/menu/cycle-menu',
    label: 'Thực đơn theo chu kỳ',
  },
  PartnerMenuFixedDetails: {
    path: '/admin/partner/[restaurantId]/settings/menu/fixed-menu/[menuId]',
    label: 'Chi tiết thực đơn',
  },
  PartnerMenuCycleDetails: {
    path: '/admin/partner/[restaurantId]/settings/menu/cycle-menu/[menuId]',
    label: 'Chi tiết thực đơn',
  },
  CreatePartnerMenu: {
    path: '/admin/partner/[restaurantId]/settings/menu/create',
    label: 'Tạo thực đơn',
  },
  EditPartnerMenu: {
    path: '/admin/partner/[restaurantId]/settings/menu/[menuId]',
    label: 'Chỉnh sửa thực đơn',
  },
  OrderDetail: {
    path: '/admin/order/[orderId]',
    label: 'Chi tiết đơn hàng',
  },
  UpdateDraftOrder: {
    path: adminPaths.UpdateDraftOrder,
    label: 'Chỉnh sửa',
  },
  EditOrderMissingId: {
    path: '/admin/order/edit',
    label: 'Chỉnh sửa đơn hàng',
  },
  Setting: {
    path: '/admin/setting',
    label: 'Cài đặt',
  },
  AttributesSetting: {
    path: '/admin/setting/attributes',
    label: 'Cài đặt món ăn',
  },
  AdminAccountInformationSetting: {
    path: '/admin/account/info',
    label: 'Thông tin tài khoản',
  },
  AdminAccountSetting: {
    path: '/admin/account/setting',
    label: 'Cài đặt tài khoản',
  },
  AdminAccount: {
    path: '/admin/account',
    label: 'Tài khoản',
  },
  AdminAccountPasswordSetting: {
    path: '/admin/account/password',
    label: 'Mật khẩu',
  },
  AdminPayment: {
    path: '/admin/payment',
    label: 'Thanh toán',
  },
  PartnerPayment: {
    path: '/admin/payment-partner',
    label: 'Thanh toán đối tác',
  },
  ClientPayment: {
    path: '/admin/payment-client',
    label: 'Thanh toán khách hàng',
  },
  ManageReviews: {
    path: '/admin/reviews',
    label: 'Quản lý đánh giá',
  },
  PccDashboard: {
    path: '/admin/pcc-dashboard',
    label: 'PCC Dashboard',
  },
  PccPersonalization: {
    path: '/admin/pcc-personalization',
    label: 'PCC Personalization',
  },
} as const;

export const companyPaths = {
  Home: '/company/[companyId]/dashboard',
  Detail: '/company/[companyId]',
  Account: '/company/[companyId]/account',
  ManageOrders: '/company/[companyId]/orders',
  ManageOrderDetail: '/company/orders/[orderId]',
  ManageOrderPicking: '/company/orders/[orderId]/picking',
  OrderRating: '/company/orders/[orderId]/rating',
  GroupSetting: '/company/[companyId]/group-setting',
  Logo: '/company/[companyId]/logo',
  Members: '/company/[companyId]/members',
  MembersDetail: '/company/[companyId]/members/[memberEmail]',
  EditDraftOrder: '/company/booker/orders/draft/[orderId]',
  OrderSelectRestaurant: '/company/booker/orders/draft/[orderId]/restaurants',
  GroupDetail: '/company/[companyId]/group-setting',
  GroupMemberDetail:
    '/company/[companyId]/group-setting/[groupId]/member/[memberId]',
  Nutrition: '/company/[companyId]/nutrition',
};

export const quizPaths = {
  Welcome: '/company/booker/orders/new/quiz/welcome',
  SelectCompany: '/company/booker/orders/new/quiz/select-company',
  PerpackMemberAmount: '/company/booker/orders/new/quiz/perpack-member-amount',
  SpecialDemand: '/company/booker/orders/new/quiz/special-demand',
  MealStyles: '/company/booker/orders/new/quiz/meal-styles',
  Restaurants: '/company/booker/orders/new/quiz/restaurants',
  MealDates: '/company/booker/orders/new/quiz/meal-date',
  CreatingOrder: '/company/booker/orders/new/quiz/creating-order',
};

export const participantPaths = {
  Order: '/participant/order/[orderId]',
  OrderList: '/participant/orders',
  SubOrderList: '/participant/sub-orders',
  Account: '/participant/account',
  AccountProfile: '/participant/account/profile',
  AccountChangePassword: '/participant/account/change-password',
  AccountSpecialDemand: '/participant/account/special-demand',
  PlanDetail: '/participant/plans/[planId]',
  Invitation: '/participant/invitation/[companyId]',
  order: {
    '[orderId]': {
      index: (orderId: string) => `/participant/order/${orderId}`,
    },
  },

  invitation: {
    '[companyId]': {
      index: (companyId: string) => `/participant/invitation/${companyId}`,
    },
  },
  plans: {
    '[planId]': {
      index: (planId: string) => `/participant/plans/${planId}`,
    },
  },
  company: {
    '[companyId]': {
      orders: {
        new: {
          index: (companyId: string) =>
            `/participant/company/${companyId}/orders/new`,
        },
      },
    },
  },
  qrcode: {
    '[groupId]': {
      index: (groupId: string) => `/participant/qrcode/${groupId}`,
    },
  },
};

export const partnerPaths = {
  Home: '/partner',
  ManageOrders: '/partner/orders',
  ManagePayments: '/partner/payments',
  SubOrderDetail: '/partner/orders/[subOrderId]',
  Settings: '/partner/settings',
  ChangePassword: '/partner/settings/change-password',
  AccountSettings: '/partner/settings/account',
  AccountSettingsDetail: '/partner/settings/account/info',
  MenuSettings: '/partner/settings/account/menu',
  BankSettings: '/partner/settings/account/bank',
  RestaurantSettings: '/partner/settings/restaurant',
  Products: '/partner/products',
  ManageFood: '/partner/products/food',
  CreateFood: '/partner/products/food/create',
  EditFood: '/partner/products/food/[foodId]',
  ManageMenus: '/partner/products/menu',
  CreateMenu: '/partner/products/menu/create',
  EditMenu: '/partner/products/menu/[menuId]',
  ManageReviews: '/partner/reviews',
};

export const partnerRoutes = {
  ManageOrders: {
    path: partnerPaths.ManageOrders,
    label: 'Danh sách đơn hàng',
  },
  Home: {
    path: partnerPaths.Home,
    label: 'Trang chủ',
  },
  SubOrderDetail: {
    path: partnerPaths.SubOrderDetail,
    label: 'Chi tiết đơn hàng',
  },
  ManagePayments: {
    path: partnerPaths.ManagePayments,
    label: 'Thanh toán',
  },
  Settings: {
    path: partnerPaths.Settings,
    label: 'Cài đặt',
  },
  AccountSettings: {
    path: partnerPaths.AccountSettings,
    label: 'Cài đặt tài khoản',
  },
  PasswordSettings: {
    path: partnerPaths.ChangePassword,
    label: 'Cài đặt mật khẩu',
  },
  RestaurantSettings: {
    path: partnerPaths.RestaurantSettings,
    label: 'Cài đặt nhà hàng',
  },
  Products: {
    path: partnerPaths.Products,
    label: 'Sản phẩm',
  },
  ManageFood: {
    path: partnerPaths.ManageFood,
    label: 'Danh sách món ăn',
  },
  CreateFood: {
    path: partnerPaths.CreateFood,
    label: 'Tạo món ăn',
  },
  EditFood: {
    path: partnerPaths.EditFood,
    label: 'Chỉnh sửa món ăn',
  },
  Reviews: {
    path: partnerPaths.ManageReviews,
    label: 'Đánh giá',
  },
  ManageMenus: {
    path: partnerPaths.ManageMenus,
    label: 'Thực đơn',
  },
  CreateMenu: {
    path: partnerPaths.CreateMenu,
    label: 'Tạo thực đơn',
  },
  EditMenu: {
    path: partnerPaths.EditMenu,
    label: 'Chỉnh sửa thực đơn',
  },
};

export const thankYouPaths =
  'https://pito.vn/cam-nang/cloud-canteen/cam-on-ban-da-dang-ky-tu-van/';
