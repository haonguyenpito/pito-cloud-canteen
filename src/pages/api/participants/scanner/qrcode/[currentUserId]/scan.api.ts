import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import type { NextApiRequest, NextApiResponse } from 'next';

import { HttpMethod } from '@apis/configs';
import type { FirebaseScannedRecord } from '@pages/admin/order/FirebaseScannedRecord';
import type { POSTScannerParticipantScanQRcodeBody } from '@pages/qrcode/POSTScannerPlanIdTimestampScanORCodeBody';
import { denormalisedResponseEntities } from '@services/data';
import { firestore } from '@services/firebase';
import { getIntegrationSdk } from '@services/sdk';
import type { FoodListing, MemberOrderValue, UserListing } from '@src/types';
import { EImageVariants, EOrderStates, EOrderType } from '@src/utils/enums';
import { getOrSetRedisCache } from '@src/utils/redisCache';
import type { TObject } from '@src/utils/types';

const CACHE_TTL_SECONDS = 60 * 60 * 2; // 2 hours

// ==================== CONSTANTS ====================
const ERROR_MESSAGES = {
  INVALID_USER_ID:
    'Không thể xác nhận thông tin của bạn. Vui lòng thử lại hoặc liên hệ hỗ trợ.',
  PLAN_NOT_FOUND:
    'Bạn chưa có kế hoạch ăn uống. Vui lòng đăng ký trước khi sử dụng dịch vụ.',
  ORDER_NOT_FOUND:
    'Hiện bạn chưa có đơn hàng nào. Vui lòng đặt món trước khi quét mã.',
  USER_NOT_IN_ORDER:
    'Tài khoản của bạn không có trong đơn hàng này. Vui lòng kiểm tra lại thông tin.',
  ACTIVE_ORDER_NOT_FOUND:
    'Bạn chưa có đơn hàng nào đang hoạt động. Hãy kiểm tra lại lịch đặt món.',
  INVALID_DATE: 'Ngày bạn chọn không hợp lệ. Vui lòng chọn lại ngày phù hợp.',
  MEMBER_NOT_FOUND:
    'Không tìm thấy thông tin tài khoản. Vui lòng kiểm tra hoặc liên hệ hỗ trợ.',
  NO_FOOD_SELECTED: 'Bạn chưa chọn món ăn. Vui lòng đặt món trước khi quét mã.',
  MEMBER_DATA_NOT_LOADED:
    'Hệ thống đang tải thông tin của bạn. Vui lòng chờ trong giây lát rồi thử lại.',
  NOT_IN_GROUP: 'Tài khoản của bạn không thuộc nhóm được phục vụ món ăn này.',
  ALREADY_SCANNED: 'Bạn đã nhận món hôm nay rồi. Hẹn gặp lại bạn vào ngày mai!',
  INTERNAL_ERROR:
    'Hệ thống đang gặp sự cố. Vui lòng thử lại sau hoặc liên hệ hỗ trợ.',
  METHOD_NOT_ALLOWED: 'Thao tác này hiện không được hỗ trợ.',
  COMPANY_NOT_FOUND:
    'Không tìm thấy thông tin công ty liên kết với tài khoản của bạn.',
  FIREBASE_ERROR: 'Lỗi kết nối dữ liệu. Vui lòng kiểm tra mạng và thử lại.',
  SDK_ERROR: 'Đang gặp sự cố kỹ thuật. Vui lòng chờ một chút rồi thử lại.',
  GROUP_NOT_FOUND: 'Không tìm thấy nhóm phù hợp với thông tin của bạn.',
  USER_NOT_IN_REQUESTED_GROUP:
    'Bạn không thuộc nhóm được áp dụng cho món ăn này.',
} as const;

const ERROR_STATUS_MAP: Record<string, number> = {
  [ERROR_MESSAGES.INVALID_USER_ID]: 400,
  [ERROR_MESSAGES.INVALID_DATE]: 400,
  [ERROR_MESSAGES.NO_FOOD_SELECTED]: 400,
  [ERROR_MESSAGES.NOT_IN_GROUP]: 403,
  [ERROR_MESSAGES.USER_NOT_IN_REQUESTED_GROUP]: 403,
  [ERROR_MESSAGES.METHOD_NOT_ALLOWED]: 405,
  [ERROR_MESSAGES.ALREADY_SCANNED]: 409,
  [ERROR_MESSAGES.PLAN_NOT_FOUND]: 404,
  [ERROR_MESSAGES.ORDER_NOT_FOUND]: 404,
  [ERROR_MESSAGES.USER_NOT_IN_ORDER]: 404,
  [ERROR_MESSAGES.ACTIVE_ORDER_NOT_FOUND]: 404,
  [ERROR_MESSAGES.MEMBER_NOT_FOUND]: 404,
  [ERROR_MESSAGES.MEMBER_DATA_NOT_LOADED]: 500,
  [ERROR_MESSAGES.COMPANY_NOT_FOUND]: 404,
  [ERROR_MESSAGES.GROUP_NOT_FOUND]: 404,
  [ERROR_MESSAGES.INTERNAL_ERROR]: 500,
  [ERROR_MESSAGES.FIREBASE_ERROR]: 500,
  [ERROR_MESSAGES.SDK_ERROR]: 500,
};

// ==================== TYPES ====================
class APIError extends Error {
  statusCode: number;

  data?: any;

  constructor(message: string, statusCode?: number, data?: any) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode || ERROR_STATUS_MAP[message] || 500;
    this.data = data;
  }
}

interface ScanContext {
  currentUserId: string;
  timestamp: string;
  timestampNum: number;
  planId: string;
  groupId?: string;
  screen?: string;
  orderId: string;
  companyId: string;
}

interface ProcessedData {
  memberOrder: Partial<MemberOrderValue>;
  foodListing: FoodListing;
  secondFoodListing?: FoodListing;
  memberListing: UserListing;
  memberId: string;
}

// ==================== UTILITIES ====================
const buildFullName = (
  firstName?: string,
  lastName?: string,
  displayName?: string,
): string => {
  if (!firstName || !lastName) return firstName || lastName || '';
  if (firstName === lastName) return firstName;
  const fullName = `${lastName} ${firstName}`;

  return displayName && displayName.length > fullName.length
    ? displayName
    : fullName;
};

const logScanResult = (
  memberId: string,
  timestamp: string,
  planId: string,
  foodTitle: string,
  isSuccess: boolean = true,
  screen?: string,
): void => {
  const formattedTimestamp = new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
  });
  const status = isSuccess ? 'successfully scanned' : 'already scanned';
  const screenInfo = screen ? ` on screen ${screen}` : '';

  console.log(
    `[LOG QRCode] QR Code ${status} for user ${memberId} planId ${planId} timestamp: ${timestamp} ${
      isSuccess ? ` food: ${foodTitle}` : ''
    }${screenInfo} at ${formattedTimestamp}`,
  );
};

// ==================== OPTIMIZED CORE FUNCTIONS ====================
const validateRequest = (req: NextApiRequest): ScanContext => {
  if (req.method !== HttpMethod.POST) {
    throw new APIError(ERROR_MESSAGES.METHOD_NOT_ALLOWED);
  }

  const { currentUserId } = req.query as { currentUserId: string };
  const { groupId, timestamp, screen, companyId } =
    req.body as POSTScannerParticipantScanQRcodeBody;

  if (!currentUserId || typeof currentUserId !== 'string') {
    throw new APIError(ERROR_MESSAGES.INVALID_USER_ID);
  }

  const timestampNum = +timestamp;

  return {
    currentUserId,
    timestamp,
    timestampNum,
    planId: '', // Will be filled later
    groupId,
    screen,
    orderId: '', // Will be filled later
    companyId,
  };
};

const findActiveOrder = async (
  context: ScanContext,
  integrationSdk: any,
): Promise<ScanContext> => {
  const { currentUserId, timestampNum, companyId } = context;
  const cacheKey = `companyOrdersInProgess:${companyId}:${timestampNum}:${context.groupId}`;
  const companyOrders = await getOrSetRedisCache(
    cacheKey,
    CACHE_TTL_SECONDS,
    async () => {
      const response = await integrationSdk.listings.query({
        meta_listingType: 'order',
        meta_orderType: EOrderType.group,
        meta_orderState: EOrderStates.inProgress,
        meta_selectedGroups: `has_any:${context.groupId},allMembers`,
        meta_companyId: companyId,
      });

      return denormalisedResponseEntities(response) || [];
    },
  );

  const activeOrder = companyOrders.find((order: TObject) => {
    const { startDate, endDate } = order?.attributes?.metadata || {};

    return startDate <= timestampNum && timestampNum <= endDate;
  });

  if (!activeOrder) {
    throw new APIError(ERROR_MESSAGES.ACTIVE_ORDER_NOT_FOUND);
  }

  const metadata = activeOrder?.attributes?.metadata;
  const isValidUser =
    metadata?.participants?.includes(currentUserId) ||
    metadata?.anonymous?.includes(currentUserId);

  if (!isValidUser) {
    throw new APIError(ERROR_MESSAGES.USER_NOT_IN_ORDER);
  }

  const planId = metadata?.plans?.[0];
  const orderId = activeOrder?.id?.uuid;

  return { ...context, planId, orderId };
};

const checkDuplicateScan = async ({
  memberId,
  planId,
  timestamp,
}: {
  memberId: string;
  planId: string;
  timestamp: number;
}): Promise<void> => {
  const scannedRecordRef = collection(
    firestore,
    process.env.NEXT_PUBLIC_FIREBASE_SCANNED_RECORDS_COLLECTION_NAME!,
  );

  const filters = [
    where('memberId', '==', memberId),
    where('planId', '==', planId),
    where('timestamp', '==', timestamp),
  ];

  const q = query(scannedRecordRef, ...filters);
  const querySnapshot = await getDocs(q);

  if (!querySnapshot.empty) {
    const existingData = querySnapshot.docs[0].data();
    throw new APIError(ERROR_MESSAGES.ALREADY_SCANNED, 409, {
      isAlreadyScanned: true,
      data: existingData,
    });
  }
};

const validateBarcodeAndGetMemberOrder = async (
  context: ScanContext,
  integrationSdk: any,
): Promise<{ memberOrder: Partial<MemberOrderValue>; memberId: string }> => {
  const { planId, timestampNum, currentUserId } = context;
  const cacheKey = `planIdWithTimestamp:${planId}:${timestampNum}`;

  const orderDetailForTimestamp = await getOrSetRedisCache(
    cacheKey,
    CACHE_TTL_SECONDS,
    async () => {
      const planListingResponse = await integrationSdk.listings.show({
        id: planId,
      });
      const planListing = planListingResponse?.data?.data;

      if (!planListing) {
        throw new APIError(ERROR_MESSAGES.PLAN_NOT_FOUND);
      }

      const orderDetail = planListing?.attributes?.metadata?.orderDetail;
      if (!orderDetail || !orderDetail[timestampNum]) {
        throw new APIError(ERROR_MESSAGES.ORDER_NOT_FOUND);
      }

      return orderDetail[timestampNum];
    },
  );

  const memberOrder = orderDetailForTimestamp?.memberOrders?.[currentUserId];

  if (!memberOrder?.foodId) {
    throw new APIError(ERROR_MESSAGES.NO_FOOD_SELECTED);
  }

  return {
    memberOrder,
    memberId: currentUserId,
  };
};

const validateGroupAccess = async (
  context: ScanContext,
  integrationSdk: any,
): Promise<void> => {
  if (!context.groupId) return;

  // 1. Cache orderDetail listing theo orderId
  const orderDetailData = await getOrSetRedisCache(
    `orderDetailListing:${context.orderId}`,
    CACHE_TTL_SECONDS,
    async () => {
      const response = await integrationSdk.listings.show({
        id: context.orderId,
      });

      return denormalisedResponseEntities(response)[0];
    },
  );

  const companyId = orderDetailData?.attributes?.metadata?.companyId;

  if (!companyId) {
    throw new APIError(ERROR_MESSAGES.COMPANY_NOT_FOUND);
  }

  // 2. Cache user (company account) theo companyId
  const companyAccount = await getOrSetRedisCache(
    `companyAccount:${companyId}`,
    CACHE_TTL_SECONDS,
    async () => {
      const response = await integrationSdk.users.show({ id: companyId });

      return denormalisedResponseEntities(response)[0];
    },
  );

  const groups = companyAccount?.attributes?.profile?.metadata?.groups;
  const requestedGroup = groups?.find(
    (group: TObject) => group.id === context.groupId,
  );

  const isInGroup = requestedGroup?.members?.some(
    (member: TObject) => member.id === context.currentUserId,
  );

  if (!isInGroup) {
    throw new APIError(ERROR_MESSAGES.USER_NOT_IN_REQUESTED_GROUP);
  }
};

const fetchFoodAndMemberData = async (
  memberOrder: Partial<MemberOrderValue>,
  memberId: string,
  integrationSdk: any,
): Promise<{
  foodListing: FoodListing;
  memberListing: UserListing;
  secondFoodListing?: FoodListing;
}> => {
  const [
    foodListingResponse,
    memberListingResponse,
    secondFoodListingResponse,
  ] = await Promise.all([
    integrationSdk.listings.show({
      id: memberOrder.foodId,
      include: ['images'],
      'fields.image': [`variants.${EImageVariants.squareSmall}`],
    }),
    integrationSdk.users.show({
      id: memberId,
      include: ['profileImage'],
      'fields.image': [`variants.${EImageVariants.squareSmall}`],
    }),
    memberOrder.secondaryFoodId
      ? integrationSdk.listings.show({
          id: memberOrder.secondaryFoodId,
          include: ['images'],
          'fields.image': [`variants.${EImageVariants.squareSmall}`],
        })
      : Promise.resolve(undefined),
  ]);

  const foodListing = denormalisedResponseEntities(foodListingResponse)[0];
  const secondFoodListing = secondFoodListingResponse
    ? denormalisedResponseEntities(secondFoodListingResponse)[0]
    : undefined;
  const memberListing = denormalisedResponseEntities(memberListingResponse)[0];

  if (!foodListing || !memberListing?.attributes?.profile) {
    throw new APIError(ERROR_MESSAGES.MEMBER_DATA_NOT_LOADED);
  }

  return { foodListing, memberListing, secondFoodListing };
};

const getFoodName = (
  foodListing: FoodListing,
  secondFoodListing?: FoodListing,
) => {
  if (secondFoodListing) {
    if (foodListing.id?.uuid === secondFoodListing.id?.uuid) {
      return `${foodListing.attributes?.title} x2 định lượng`;
    }

    return `${foodListing.attributes?.title} + ${secondFoodListing.attributes?.title}`;
  }

  return foodListing.attributes?.title!;
};

const createScannedRecord = async (
  context: ScanContext,
  processedData: ProcessedData,
): Promise<Omit<FirebaseScannedRecord, 'id'>> => {
  const { foodListing, memberListing, secondFoodListing } = processedData;

  const record: Omit<FirebaseScannedRecord, 'id'> = {
    planId: context.planId,
    timestamp: context.timestampNum,
    memberId: context.currentUserId,
    memberProfileImageUrl:
      memberListing.profileImage?.attributes?.variants?.['square-small']?.url ||
      '',
    memberAbbrName: memberListing.attributes?.profile?.abbreviatedName || '',
    memberName: buildFullName(
      memberListing?.attributes?.profile?.firstName,
      memberListing?.attributes?.profile?.lastName,
      memberListing?.attributes?.profile?.displayName,
    ),
    foodName: getFoodName(foodListing, secondFoodListing),
    foodThumbnailUrl:
      foodListing.images?.[0]?.attributes?.variants?.['square-small']?.url ||
      '',
    state: 'live',
    scannedAt: Date.now(),
    ...(processedData?.memberOrder?.requirement && {
      note: processedData?.memberOrder?.requirement,
    }),
    ...(context.groupId && { groupId: context.groupId }),
    ...(context.screen && { screen: context.screen }),
  };

  try {
    // const scannedRecordRef = collection(
    //   firestore,
    //   process.env.NEXT_PUBLIC_FIREBASE_SCANNED_RECORDS_COLLECTION_NAME!,
    // );
    // await addDoc(scannedRecordRef, record);

    // return record;

    const recordId = `${context.planId}_${context.currentUserId}_${context.timestampNum}`;

    const scannedRecordRef = doc(
      firestore,
      process.env.NEXT_PUBLIC_FIREBASE_SCANNED_RECORDS_COLLECTION_NAME!,
      recordId,
    );

    await setDoc(scannedRecordRef, record);

    return record;
  } catch (error) {
    throw new APIError(ERROR_MESSAGES.FIREBASE_ERROR);
  }
};

// ==================== OPTIMIZED MAIN PROCESSING ====================
const processOptimizedScan = async (
  req: NextApiRequest,
): Promise<{
  context: ScanContext;
  processedData: ProcessedData;
}> => {
  const integrationSdk = await getIntegrationSdk();

  try {
    // Step 1: Validate request
    let context = validateRequest(req);

    // Step 2: Find active order
    context = await findActiveOrder(context, integrationSdk);

    // Step 3: Check for duplicate scan (fail fast)
    await checkDuplicateScan({
      memberId: context.currentUserId,
      planId: context.planId,
      timestamp: context.timestampNum,
    });

    // Step 4: Validate barcode and get member order
    const { memberOrder, memberId } = await validateBarcodeAndGetMemberOrder(
      context,
      integrationSdk,
    );

    console.log('processOptimizedScan@memberOrder: ', { memberOrder });

    // Step 5: Parallel execution - group validation and data fetching
    const [, { foodListing, memberListing, secondFoodListing }] =
      await Promise.all([
        validateGroupAccess(context, integrationSdk),
        fetchFoodAndMemberData(memberOrder, memberId, integrationSdk),
      ]);

    const processedData: ProcessedData = {
      memberOrder,
      foodListing,
      memberListing,
      memberId,
      secondFoodListing,
    };

    return { context, processedData };
  } catch (error) {
    console.error(`[LOG QRCode] Error in processOptimizedScan: ${error}`);
    if (error instanceof APIError) throw error;
    throw new APIError(ERROR_MESSAGES.SDK_ERROR);
  }
};

// ==================== MAIN HANDLER ====================
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const startTime = Date.now();

  try {
    // Single optimized processing pipeline
    const { context, processedData } = await processOptimizedScan(req);

    // Create Firebase record
    const record = await createScannedRecord(context, processedData);

    // Log success with timing
    const processingTime = Date.now() - startTime;
    console.log(`[LOG QRCode] Processing completed in ${processingTime}ms`);

    logScanResult(
      context.currentUserId,
      context.timestamp,
      context.planId,
      processedData.foodListing.attributes?.title!,
      true,
      context.screen,
    );

    return res.status(200).json(record);
  } catch (error: any) {
    const processingTime = Date.now() - startTime;

    if (error instanceof APIError) {
      if (error.statusCode === 409) {
        console.error(
          `[LOG QRCode] ${new Date().toLocaleString('en-US', {
            timeZone: 'Asia/Ho_Chi_Minh',
          })} Conflict error in scanner API (${processingTime}ms):`,
          error,
        );

        return res.status(409).json({
          message: error.message,
          ...error.data,
        });
      }

      return res.status(error.statusCode).json({ message: error.message });
    }

    console.error(
      `[LOG QRCode] ${new Date().toLocaleString('en-US', {
        timeZone: 'Asia/Ho_Chi_Minh',
      })} Unexpected error in scanner API (${processingTime}ms):`,
      error,
    );

    return res.status(500).json({ message: ERROR_MESSAGES.INTERNAL_ERROR });
  }
}
