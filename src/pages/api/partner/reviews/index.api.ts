import type { NextApiRequest, NextApiResponse } from 'next';

import { HttpMethod } from '@apis/configs';
import { queryAllListings } from '@helpers/apiHelpers';
import { isHiddenReviewUser } from '@helpers/review/visibility';
import cookies from '@services/cookie';
import partnerChecker from '@services/permissionChecker/partner';
import { getSdk, handleError } from '@services/sdk';
import {
  CurrentUser,
  denormalisedResponseEntities,
  Listing,
} from '@src/utils/data';
import { EListingType } from '@src/utils/enums';
import type { TListing } from '@src/utils/types';

async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  try {
    const apiMethod = req.method;
    const sdk = getSdk(req, res);

    switch (apiMethod) {
      case HttpMethod.GET: {
        const currentUserRes = await sdk.currentUser.show();
        const [companyAccount] = denormalisedResponseEntities(currentUserRes);
        const { restaurantListingId: restaurantId } =
          CurrentUser(companyAccount).getMetadata();
        const query = {
          meta_listingType: EListingType.rating,
          meta_restaurantId: restaurantId,
        };
        const reviews = await queryAllListings({
          query,
        });
        const visibleReviews = reviews.filter((review: TListing) => {
          const { reviewerId } = Listing(review).getMetadata();

          return !isHiddenReviewUser(reviewerId);
        });
        const mapRatingDetail = new Map<number, number>([
          [1, 0],
          [2, 0],
          [3, 0],
          [4, 0],
          [5, 0],
        ]);

        let totalRating = 0;
        let totalFoodRating = 0;
        let totalPackagingRating = 0;

        visibleReviews.forEach((review: TListing) => {
          const { generalRating: rating } = Listing(review).getMetadata();
          const { detailRating = {} } = Listing(review).getMetadata();
          const ratingTotal: number = (mapRatingDetail.get(rating) ?? 0) + 1;
          totalRating += Number(rating || 0);
          totalFoodRating += Number(detailRating?.food?.rating || 0);
          totalPackagingRating += Number(detailRating?.packaging?.rating || 0);
          mapRatingDetail.set(rating, ratingTotal);
        });

        const totalNumberOfReivews = visibleReviews.length;
        const averageTotalRating = totalNumberOfReivews
          ? totalRating / totalNumberOfReivews
          : 0;
        const averageFoodRating = totalNumberOfReivews
          ? totalFoodRating / totalNumberOfReivews
          : 0;
        const averagePackagingRating = totalNumberOfReivews
          ? totalPackagingRating / totalNumberOfReivews
          : 0;

        return res.status(200).json({
          ratingDetail: Array.from(mapRatingDetail.keys()).map((key) => ({
            rating: key,
            total: mapRatingDetail.get(key),
          })),
          averageFoodRating,
          averagePackagingRating,
          averageTotalRating,
          totalNumberOfReivews,
        });
      }

      default:
        break;
    }
  } catch (error) {
    console.error(error);
    handleError(res, error);
  }
}

export default cookies(partnerChecker(handler));
