import _ from 'lodash';

import { queryAllListings } from '@helpers/apiHelpers';
import { isHiddenReviewUser } from '@helpers/review/visibility';
import { EListingType } from '@src/utils/enums';
import { Listing } from '@utils/data';

const getReviews = async (
  restaurantId: string,
  page: number,
  perPage: number,
  ratings: number[],
) => {
  const query = {
    meta_listingType: EListingType.rating,
    meta_restaurantId: restaurantId,
  };

  const reviewListings: [] = await queryAllListings({
    query,
  });

  const filterReview = reviewListings.filter((review) => {
    const { generalRating, reviewerId } = Listing(review).getMetadata();

    if (isHiddenReviewUser(reviewerId)) {
      return false;
    }

    if (ratings.length >= 5 || !ratings.length) {
      return true;
    }

    return ratings.findIndex((rating) => rating === generalRating) >= 0;
  });
  const totalPages = Math.ceil(filterReview.length / perPage);

  const pagination = {
    totalItems: filterReview.length,
    totalPages,
    page,
    perPage,
    paginationLimit: totalPages,
  };

  const startIndex = (page - 1) * perPage;
  const endIndex = startIndex + perPage;
  const data = _.slice(filterReview, startIndex, endIndex);

  return {
    pagination,
    data,
  };
};

export default getReviews;
