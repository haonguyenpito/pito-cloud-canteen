import type { NextApiRequest, NextApiResponse } from 'next';
import * as XLSX from 'xlsx';

import { HttpMethod } from '@apis/configs';
import cookies from '@services/cookie';
import { denormalisedResponseEntities } from '@services/data';
import { getIntegrationSdk } from '@services/sdk';
import type {
  OrderListing,
  RatingListing,
  TReviewReply,
  UserListing,
  WithFlexSDKData,
} from '@src/types';
import { EImageVariants, EListingType, EUserRole } from '@src/utils/enums';

export const retrieveAll = async <T extends Array<any>>(
  queryFunction: (params: any) => Promise<WithFlexSDKData<T>>,
  params: any,
  options?: {
    denormalizeResponseEntities?: boolean;
  },
): Promise<T> => {
  const allPages: T = [] as any;
  let page = 1;
  let responses: WithFlexSDKData<T[]> = {} as any;

  do {
    // eslint-disable-next-line no-await-in-loop
    responses = await queryFunction({ ...params, page });
    if (options?.denormalizeResponseEntities) {
      allPages.push(...denormalisedResponseEntities(responses));
    } else {
      allPages.push(...responses.data.data);
    }

    page += 1;
  } while (
    responses.data.meta?.totalPages &&
    page <= responses.data.meta?.totalPages
  );

  return allPages;
};

export const retrieveAllByIdChunks = async <T extends Array<any>>(
  queryFunction: (params: any) => Promise<WithFlexSDKData<T>>,
  generateParamsFromId: (ids: string[]) => any,
  ids: string[],
  params: any,
  options?: { chunkSize?: number; denormalizeResponseEntities?: boolean },
): Promise<T> => {
  const chunkSize = options?.chunkSize || 100;
  const denormalizeResponseEntities =
    options?.denormalizeResponseEntities || false;

  if (ids.length === 0) {
    return [] as any;
  }

  const uniqueIds = Array.from(new Set(ids));

  const allIds = uniqueIds.reduce(
    (acc: string[][], id: string, index: number) => {
      const chunkIndex = Math.floor(index / chunkSize);
      if (!acc[chunkIndex]) {
        acc[chunkIndex] = [];
      }
      acc[chunkIndex].push(id);

      return acc;
    },
    [] as string[][],
  );

  const allPages: T = [] as any;

  const chunkPromises = allIds.map((chunk) => {
    const chunkParams = {
      ...(params || {}),
      ...(generateParamsFromId(chunk) || {}),
    };

    return queryFunction(chunkParams);
  });

  const settledResponses = await Promise.allSettled(chunkPromises);
  settledResponses.forEach((settled) => {
    if (settled.status === 'fulfilled') {
      if (denormalizeResponseEntities) {
        allPages.push(...denormalisedResponseEntities(settled.value));
      } else if (settled.value.data.data) {
        allPages.push(...settled.value.data.data);
      }
    } else {
      console.error('Error fetching chunk:', settled.reason);
    }
  });

  return allPages;
};

const getReplyRoleLabel = (replyRole: EUserRole): string => {
  const labels: Record<EUserRole, string> = {
    [EUserRole.admin]: 'Admin',
    [EUserRole.company]: 'Company',
    [EUserRole.partner]: 'Partner',
    [EUserRole.booker]: 'Booker',
    [EUserRole.participant]: 'Participant',
  };
  return labels[replyRole] ?? 'NA';
};

/** Format replies as single string for export (e.g. "Author (Role): content\n...") */
const formatRepliesForExport = (replies: TReviewReply[] | undefined): string => {
  if (!replies?.length) return '';
  return replies
    .filter((r): r is TReviewReply => !!r)
    .map(
      (r) =>
        `${r.authorName || 'NA'} (${getReplyRoleLabel(r.replyRole)}): ${(r.replyContent || '').replace(/\n/g, ' ')}`,
    )
    .join('\n');
};

/**
 * Generate XLSX file from ratings data
 */
const generateRatingsXLSX = (
  ratings: Array<
    RatingListing & {
      reviewer?: UserListing;
      order?: OrderListing;
    }
  >,
): Buffer => {
  console.log('Starting XLSX generation with ratings count:', ratings.length);

  // Prepare data for Excel
  const excelData = ratings.map((rating, index) => {
    console.log(`Processing rating ${index + 1}:`, {
      id: rating.id?.uuid,
      hasMetadata: !!rating.attributes?.metadata,
      hasReviewer: !!rating.reviewer,
      hasOrder: !!rating.order,
    });

    const metadata = rating.attributes?.metadata;
    const orderCode =
      rating.order?.attributes?.title || metadata?.orderCode || '';
    const ratingScore = metadata?.generalRating || '';
    const comment = metadata?.detailTextRating || '';
    const reviewerName =
      rating.reviewer?.attributes?.profile?.displayName || '';
    const reviewerEmail = rating.reviewer?.attributes?.email || '';
    const timestamp = metadata?.timestamp;
    const date = timestamp ? new Date(+timestamp).toLocaleDateString() : '';
    const restaurantId = metadata?.restaurantId || '';
    const foodName = metadata?.foodName || '';
    const repliesText = formatRepliesForExport(metadata?.replies);

    return {
      'Rating ID': rating.id?.uuid || '',
      'Order Code': orderCode,
      'Rating Score': ratingScore,
      Comment: comment,
      'Reviewer Name': reviewerName,
      'Reviewer Email': reviewerEmail,
      Date: date,
      'Restaurant ID': restaurantId,
      'Food Name': foodName,
      'Phản hồi': repliesText,
    };
  });

  console.log('Excel data prepared, sample row:', excelData[0]);

  try {
    // Create workbook and worksheet
    console.log('Creating XLSX workbook...');
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Auto-size columns
    const columnWidths = [
      { wch: 20 }, // Rating ID
      { wch: 15 }, // Order Code
      { wch: 12 }, // Rating Score
      { wch: 40 }, // Comment
      { wch: 20 }, // Reviewer Name
      { wch: 25 }, // Reviewer Email
      { wch: 12 }, // Date
      { wch: 20 }, // Restaurant ID
      { wch: 25 }, // Food Name
      { wch: 50 }, // Phản hồi
    ];
    worksheet['!cols'] = columnWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Ratings Export');
    console.log('Worksheet added to workbook');

    // Generate buffer
    console.log('Generating XLSX buffer...');
    const excelBuffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    });

    console.log(
      'XLSX buffer generated successfully, size:',
      excelBuffer.length,
    );

    return excelBuffer as Buffer;
  } catch (error) {
    console.error('Error in XLSX generation:', error);
    throw error;
  }
};

/**
 * Generate CSV file as fallback
 */
const generateRatingsCSV = (
  ratings: Array<
    RatingListing & {
      reviewer?: UserListing;
      order?: OrderListing;
    }
  >,
): string => {
  const headers = [
    'Rating ID',
    'Order Code',
    'Rating Score',
    'Comment',
    'Reviewer Name',
    'Reviewer Email',
    'Date',
    'Restaurant ID',
    'Food Name',
    'Phản hồi',
  ];

  const csvRows = [headers.join(',')];

  ratings.forEach((rating) => {
    const metadata = rating.attributes?.metadata;
    const orderCode =
      rating.order?.attributes?.title || metadata?.orderCode || '';
    const ratingScore = metadata?.generalRating || '';
    const comment = metadata?.detailTextRating || '';
    const reviewerName =
      rating.reviewer?.attributes?.profile?.displayName || '';
    const reviewerEmail = rating.reviewer?.attributes?.email || '';
    const timestamp = metadata?.timestamp;
    const date = timestamp ? new Date(+timestamp).toLocaleDateString() : '';
    const restaurantId = metadata?.restaurantId || '';
    const foodName = metadata?.foodName || '';
    const repliesText = formatRepliesForExport(metadata?.replies);

    const row = [
      rating.id?.uuid || '',
      `"${orderCode}"`,
      ratingScore,
      `"${comment.replace(/"/g, '""')}"`, // Escape quotes in comment
      `"${reviewerName}"`,
      `"${reviewerEmail}"`,
      date,
      `"${restaurantId}"`,
      `"${foodName}"`,
      `"${repliesText.replace(/"/g, '""')}"`,
    ];

    csvRows.push(row.join(','));
  });

  return csvRows.join('\n');
};

export interface GETExportCompanyRaitingsQuery {
  startDate?: string;
  endDate?: string;
}

/**
 * Export company ratings to XLSX format
 * GET /api/admin/company/[companyId]/ratings/export
 *
 * @param startDate - Start date for rating filter (required)
 * @param endDate - End date for rating filter (required)
 * @returns XLSX file with ratings data including reviewer info and order details
 */
const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const integrationSdk = getIntegrationSdk();
  const { method } = req;
  const { companyId, JSONParams } = req.query as unknown as {
    companyId: string;
    JSONParams: string;
  };

  // format Json PArams like GETCompanyRaitingsQuery
  const { endDate, startDate } = JSONParams
    ? (JSON.parse(JSONParams) as GETExportCompanyRaitingsQuery)
    : ({} as GETExportCompanyRaitingsQuery);

  if (method !== HttpMethod.GET) {
    return res.json({ message: 'Method not allowed' });
  }

  if (!companyId) {
    return res.status(400).json({ message: 'Missing companyId' });
  }

  if (!startDate || !endDate) {
    return res
      .status(400)
      .json({ message: 'startDate and endDate are required for export' });
  }

  try {
    // Get all ratings without pagination using retrieveAll
    const ratingListingsData = await retrieveAll<RatingListing[]>(
      integrationSdk.listings.query,
      {
        meta_listingType: EListingType.rating,
        meta_companyId: companyId as string,
        // Fix: Set end date to end of day (23:59:59.999) to include same-day ranges
        meta_timestamp: `${new Date(startDate).valueOf() - 1},${new Date(
          endDate,
        ).setHours(23, 59, 59, 999)}`,
        include: ['images'],
        'fields.image': [`variants.${EImageVariants.squareSmall2x}`],
      },
    );

    const reviewerIds = ratingListingsData.reduce((acc: string[], rating) => {
      const metadata = rating.attributes?.metadata;
      const reviewerId = metadata?.reviewerId;
      if (reviewerId) {
        acc.push(reviewerId);
      }

      return acc;
    }, []);

    const orderIds = ratingListingsData.reduce((acc: string[], rating) => {
      const metadata = rating.attributes?.metadata;
      const orderId = metadata?.orderId;
      if (orderId) {
        acc.push(orderId);
      }

      return acc;
    }, []);
    const ordersData = await retrieveAllByIdChunks<OrderListing[]>(
      integrationSdk.listings.query,
      (ids) => ({
        meta_id: ids,
      }),
      orderIds,
      {
        meta_listingType: EListingType.order,
      },
    );

    const reviewersData = await retrieveAllByIdChunks<UserListing[]>(
      integrationSdk.users.query,
      (ids) => ({
        meta_id: ids,
      }),
      reviewerIds,
      {
        include: ['profileImage'],
      },
      {
        denormalizeResponseEntities: true,
      },
    );

    const ratingsWithReviewersAndOrder = ratingListingsData.map((rating) => {
      const metadata = rating.attributes?.metadata;
      const reviewerId = metadata?.reviewerId;
      const reviewerData = reviewersData.find(
        (user) => user.id?.uuid === reviewerId,
      );
      const orderId = metadata?.orderId;
      const orderData = ordersData.find((order) => order.id?.uuid === orderId);

      return {
        ...rating,
        reviewer: reviewerData,
        order: orderData,
      };
    });

    // Generate XLSX file
    console.log(
      'ratingsWithReviewersAndOrder count:',
      ratingsWithReviewersAndOrder.length,
    );

    // Temporary: return JSON to debug data structure
    if (req.query.debug === 'true') {
      return res.status(200).json({
        message: 'Debug mode - returning raw data',
        count: ratingsWithReviewersAndOrder.length,
        sample: ratingsWithReviewersAndOrder.slice(0, 2), // First 2 items for inspection
        startDate,
        endDate,
      });
    }

    if (ratingsWithReviewersAndOrder.length === 0) {
      return res
        .status(404)
        .json({ message: 'No ratings found for the specified date range' });
    }

    try {
      const excelBuffer = generateRatingsXLSX(ratingsWithReviewersAndOrder);
      console.log('Excel buffer generated, size:', excelBuffer.length);

      // Set headers for Excel download
      const fileName = `ratings-export-${startDate}-to-${endDate}.xlsx`;
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${fileName}"`,
      );

      // Send the Excel file
      return res.status(200).send(excelBuffer);
    } catch (xlsxError) {
      console.error('XLSX generation failed, falling back to CSV:', xlsxError);

      // Fallback to CSV
      try {
        const csvContent = generateRatingsCSV(ratingsWithReviewersAndOrder);
        const csvFileName = `ratings-export-${startDate}-to-${endDate}.csv`;

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${csvFileName}"`,
        );

        return res.status(200).send(csvContent);
      } catch (csvError) {
        console.error('CSV generation also failed:', csvError);

        return res.status(500).json({
          message: 'Error generating both Excel and CSV files',
          xlsxError: String(xlsxError),
          csvError: String(csvError),
        });
      }
    }
  } catch (error) {
    console.error('Error exporting ratings to XLSX:', error);
    res.status(500).json({ message: 'Error exporting ratings to XLSX' });
  }
};

export default cookies(handler);
