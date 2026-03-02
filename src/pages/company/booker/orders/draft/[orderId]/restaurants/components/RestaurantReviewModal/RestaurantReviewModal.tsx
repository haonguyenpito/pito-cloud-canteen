import { useCallback, useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';

import IconArrow from '@components/Icons/IconArrow/IconArrow';
import Modal from '@components/Modal/Modal';
import RenderWhen from '@components/RenderWhen/RenderWhen';
import SlideModal from '@components/SlideModal/SlideModal';
import Tabs from '@components/Tabs/Tabs';
import { useViewport } from '@hooks/useViewport';
import type { TReviewReply } from '@src/types';
import { Listing } from '@src/utils/data';
import type { TListing } from '@src/utils/types';

import type { RatingListingWithReviewer } from '../../BookerSelectRestaurant.slice';
import useRestaurantReview from '../../hooks/restaurantReview';
import ReviewItem from '../ReviewItem/ReviewItem';

import css from './RestaurantReviewModal.module.scss';

type RestaurantReviewModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const ReviewItemList = ({
  reviewList,
  isFetchingMore,
  isFirstLoading,
  totalReview,
  onFetching,
}: {
  reviewList: RatingListingWithReviewer[];
  isFetchingMore: boolean;
  isFirstLoading: boolean;
  totalReview: number;
  onFetching: () => void;
}) => {
  const intl = useIntl();
  const noReview = reviewList.length === 0;
  const isShowAllReviews = reviewList.length === totalReview;

  const shouldShowLoadMore = !isFetchingMore && !isShowAllReviews && !noReview;

  return (
    <div className={css.reviewList}>
      {noReview && !isFetchingMore && (
        <div className={css.noReview}>
          {intl.formatMessage({
            id: 'OrderRatingForm.noReview',
          })}
        </div>
      )}

      {isFirstLoading ? (
        <div className={css.loading}>Đang tải...</div>
      ) : (
        reviewList.map((review) => {
          const {
            generalRating,
            detailRating,
            timestamp,
            foodName,
            secondaryFoodName,
            detailTextRating,
            replies,
          } = review.attributes?.metadata || {};
          const { createdAt: reviewAt } = review.attributes || {};
          const foodNameValue =
            foodName + (secondaryFoodName ? ` + ${secondaryFoodName}` : '');

          return (
            <div className={css.reviewItem} key={review.id?.uuid}>
              <ReviewItem
                generalRating={generalRating || 0}
                detailRating={detailRating}
                user={review.reviewer}
                timestamp={timestamp ? +timestamp : undefined}
                foodName={foodNameValue}
                detailTextRating={detailTextRating}
                reviewAt={reviewAt ? new Date(reviewAt) : undefined}
                replies={replies?.filter((r): r is TReviewReply => !!r) || []}
              />
            </div>
          );
        })
      )}

      {!isFirstLoading && isFetchingMore && (
        <div className={css.loading}>Đang tải...</div>
      )}

      {shouldShowLoadMore && (
        <div className={css.loadMore} onClick={onFetching}>
          {intl.formatMessage({
            id: 'RestaurantCard.viewDetailText',
          })}
        </div>
      )}
    </div>
  );
};

const RestaurantReviewModal: React.FC<RestaurantReviewModalProps> = (props) => {
  const { isOpen, onClose } = props;
  const intl = useIntl();
  const { isMobileLayout } = useViewport();
  const [reviewPage, setReviewPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'booker' | 'participant'>(
    'booker',
  );
  const {
    restaurantBookerReviews = [],
    restaurantParticipantReviews = [],
    selectedRestaurant,
    fetchRestaurantReviewInProgress,
    restaurantBookerReviewsMeta,
    restaurantParticipantReviewsMeta,
  } = useRestaurantReview(activeTab, reviewPage);

  const isFirstLoading = reviewPage === 1 && fetchRestaurantReviewInProgress;

  /**
   * Reset review page when change tab
   */
  useEffect(() => {
    setReviewPage(1);
  }, [activeTab]);

  const selectedRestaurantListing = useMemo(
    () => Listing(selectedRestaurant as TListing),
    [selectedRestaurant],
  );
  const { detailRating, totalRatingNumber = 0 } =
    selectedRestaurantListing.getMetadata();

  const { food, packaging } = detailRating || {};
  const totalComments = totalRatingNumber;

  const tabItems = [
    {
      id: 'booker',
      key: 'booker',
      children: '',
      label: (
        <div className={css.tabLabel}>
          <span>
            {intl.formatMessage({
              id: 'OrderRatingForm.BookerReviewTab',
            })}
          </span>
          <div data-number className={css.commentNumber}>
            {fetchRestaurantReviewInProgress
              ? '...'
              : restaurantBookerReviewsMeta?.totalItems || 0}
          </div>
        </div>
      ),
      childrenFn: (childProps: any) => <ReviewItemList {...childProps} />,
      childrenProps: {
        reviewList: restaurantBookerReviews,
        isFetchingMore: fetchRestaurantReviewInProgress,
        isFirstLoading,
        totalReview: restaurantBookerReviewsMeta?.totalItems,
        onFetching: () => setReviewPage(reviewPage + 1),
      },
    },
    {
      id: 'participant',
      key: 'participant',
      label: (
        <div className={css.tabLabel}>
          <span>
            {intl.formatMessage({
              id: 'OrderRatingForm.ParticipantReviewTab',
            })}
          </span>
          <div data-number className={css.commentNumber}>
            {fetchRestaurantReviewInProgress
              ? '...'
              : totalComments - (restaurantBookerReviewsMeta?.totalItems || 0)}
          </div>
        </div>
      ),
      children: '',
      childrenFn: (childProps: any) => <ReviewItemList {...childProps} />,
      childrenProps: {
        reviewList: restaurantParticipantReviews,
        isFetchingMore: fetchRestaurantReviewInProgress,
        isFirstLoading,
        totalReview: restaurantParticipantReviewsMeta?.totalItems,
        onFetching: () => setReviewPage(reviewPage + 1),
      },
    },
  ];

  const calculateRatingPercent = (rating: number) => {
    return `${(rating / 5) * 100}%`;
  };

  const onTabChange = useCallback((tab: any) => {
    setActiveTab(tab?.key as any);
  }, []);

  const generalView = (
    <>
      <div className={css.modalHeader}>
        <div className={css.detailRatingContainer}>
          <div className={css.detailRatingRow}>
            <span className={css.scenarioLabel}>
              {intl.formatMessage({
                id: 'AddOrderForm.foodIdField.placeholder',
              })}
              :
            </span>
            <div className={css.ratingBar}>
              <div
                style={{ width: calculateRatingPercent(food || 0) }}
                className={css.activeBar}></div>
            </div>
            <span className={css.ratingPoint}>{`${food || 0}/5`}</span>
          </div>
          <div className={css.detailRatingRow}>
            <span className={css.scenarioLabel}>
              {intl.formatMessage({
                id: 'ManagePartnerReviewsPage.packageTitle',
              })}
              :
            </span>
            <div className={css.ratingBar}>
              <div
                style={{
                  width: calculateRatingPercent(packaging || 0),
                }}
                className={css.activeBar}></div>
            </div>
            <span className={css.ratingPoint}>{`${packaging || 0}/5`}</span>
          </div>
        </div>
      </div>
      <div className={css.modalContent}>
        <div className={css.contentHeader}>
          <div className={css.totalComment}>
            {`Bình luận (${totalComments})`}
          </div>
        </div>
      </div>
    </>
  );

  const detailView = (
    <div className={css.modalContent}>
      <div className={css.contentHeader}>
        <div className={css.totalComment}>{`Bình luận (${totalComments})`}</div>
      </div>
    </div>
  );

  return (
    <RenderWhen condition={isMobileLayout}>
      <SlideModal
        id="RestaurantReviewModal"
        isOpen={isOpen}
        onClose={onClose}
        containerClassName={css.modalContainer}
        modalTitle={
          <div className={css.titleSlideModal}>
            <IconArrow direction="left" onClick={onClose} />
            <span>
              {intl.formatMessage({
                id: 'MemberDetailPage.backButton',
              })}
            </span>
          </div>
        }>
        {generalView}
        <div className={css.content}>
          <Tabs items={tabItems} onChange={onTabChange} />
        </div>
      </SlideModal>
      <RenderWhen.False>
        <Modal
          id="RestaurantReviewModal"
          isOpen={isOpen}
          handleClose={onClose}
          containerClassName={css.modalContainer}
          scrollLayerClassName={css.scrollLayer}
          title={intl.formatMessage({
            id: 'ManageCompanyOrdersPage.actionBtn.reviewOrder',
          })}>
          {detailView}
          <div className={css.content}>
            <Tabs items={tabItems} onChange={onTabChange} />
          </div>
        </Modal>
      </RenderWhen.False>
    </RenderWhen>
  );
};

export default RestaurantReviewModal;
