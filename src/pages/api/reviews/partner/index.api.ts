import type { NextApiRequest, NextApiResponse } from 'next';

import { HttpMethod } from '@apis/configs';
import { queryAllListings } from '@helpers/apiHelpers';
import { isHiddenReviewUser } from '@helpers/review/visibility';
import cookies from '@services/cookie';
import { denormalisedResponseEntities } from '@services/data';
import partnerChecker from '@services/permissionChecker/partner';
import { getIntegrationSdk, getSdk, handleError } from '@services/sdk';
import type { RatingListing } from '@src/types';
import { CurrentUser } from '@src/utils/data';
import { buildFullNameFromProfile } from '@src/utils/emailTemplate/participantOrderPicking';
import { EListingType } from '@src/utils/enums';
import { SuccessResponse } from '@src/utils/response';
import type { TPagination } from '@src/utils/types';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const apiMethod = req.method;
  try {
    const sdk = getSdk(req, res);
    const integrationSdk = getIntegrationSdk();

    switch (apiMethod) {
      case HttpMethod.GET: {
        try {
          const {
            page = 1,
            perPage = 10,
            ratings = [1, 2, 3, 4, 5],
          } = JSON.parse(req.query.JSONParams as string) as {
            page: number;
            perPage: number;
            ratings: number[] | undefined;
          };

          const currentUserRes = await sdk.currentUser.show();
          const [companyAccount] = denormalisedResponseEntities(currentUserRes);
          const { restaurantListingId: restaurantId } =
            CurrentUser(companyAccount).getMetadata();
          if (!restaurantId) {
            return res.status(401).json({ message: 'Unauthorized' });
          }
          const response = await queryAllListings({
            query: {
              meta_listingType: EListingType.rating,
              meta_restaurantId: restaurantId,
              include: ['images', 'author'],
            },
          });

          const reviews: RatingListing[] = response as RatingListing[];
          const visibleReviews = reviews.filter((review) => {
            const reviewerId = review.attributes?.metadata?.reviewerId;
            const generalRating = review.attributes?.metadata?.generalRating;

            if (isHiddenReviewUser(reviewerId)) {
              return false;
            }

            if (!ratings || !ratings.length || ratings.length >= 5) {
              return true;
            }

            return ratings.includes(Number(generalRating));
          });

          const currentPage = Number(page);
          const currentPerPage = Number(perPage);
          const startIndex = (currentPage - 1) * currentPerPage;
          const endIndex = startIndex + currentPerPage;
          const paginatedReviews = visibleReviews.slice(startIndex, endIndex);
          const totalItems = visibleReviews.length;
          const totalPages = Math.ceil(totalItems / currentPerPage);

          const reviewsWithReplies = await Promise.all(
            paginatedReviews.map(async (review) => {
              const metadata = review.attributes?.metadata;
              const authorId = metadata?.reviewerId;
              const author = await integrationSdk.users.show({
                id: authorId as string,
                include: ['profileImage'],
              });
              const [authorData] = denormalisedResponseEntities(author);

              const fullName = buildFullNameFromProfile(
                authorData.attributes.profile,
              );

              return {
                ...review,
                authorName: fullName,
              };
            }),
          );

          const pagination: TPagination = {
            page: currentPage,
            perPage: currentPerPage,
            totalItems,
            totalPages,
          };

          return new SuccessResponse({
            data: reviewsWithReplies,
            message: 'Get reviews successfully',
            pagination,
          }).send(res);
        } catch (error) {
          console.error('Error in GET reviews:', error);
          handleError(res, error);
        }
        break;
      }
      default:
        res.status(405).json({ message: 'Method not allowed' });
        break;
    }
  } catch (error) {
    console.error('Error in handler:', error);
    res.status(500).json({
      error: (error as Error).message,
      message: 'Internal server error',
    });
  }
};

export default cookies(partnerChecker(handler));
