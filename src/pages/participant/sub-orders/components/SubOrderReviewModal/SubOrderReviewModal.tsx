import { useEffect } from 'react';
import { useIntl } from 'react-intl';
import isEmpty from 'lodash/isEmpty';
import last from 'lodash/last';

import IconArrow from '@components/Icons/IconArrow/IconArrow';
import IconRatingFace from '@components/Icons/IconRatingFace/IconRatingFace';
import IconSpinner from '@components/Icons/IconSpinner/IconSpinner';
import Modal from '@components/Modal/Modal';
import RenderWhen from '@components/RenderWhen/RenderWhen';
import ResponsiveImage from '@components/ResponsiveImage/ResponsiveImage';
import { renderReplyRole } from '@helpers/review/ui';
import { useAppDispatch, useAppSelector } from '@hooks/reduxHooks';
import { useViewport } from '@hooks/useViewport';
import type { TReviewReply } from '@src/types';
import { Listing } from '@src/utils/data';
import { formatTimestamp } from '@src/utils/dates';
import { EImageVariants } from '@src/utils/enums';
import type { TImage, TListing } from '@src/utils/types';

import { SubOrdersThunks } from '../../SubOrders.slice';

import css from './SubOrderReviewModal.module.scss';

type SubOrderReviewModalProps = {
  isOpen: boolean;
  onClose: () => void;
  subOrder: any;
};

const SubOrderReviewModal: React.FC<SubOrderReviewModalProps> = (props) => {
  const { isOpen, onClose, subOrder } = props;
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const { isMobileLayout } = useViewport();
  const subOrderReview = useAppSelector(
    (state) => state.ParticipantSubOrderList.subOrderReview,
  );

  const fetchReviewInProgress = useAppSelector(
    (state) => state.ParticipantSubOrderList.fetchReviewInProgress,
  );

  const { foodName, restaurantName, id, reviewId, foodImage } = subOrder;
  const review = subOrderReview.find(
    (_review: any) => _review.id.uuid === reviewId,
  );
  const subOrderReviewListing = Listing(review as TListing);
  const timestamp = parseInt(`${last(id.split(' - '))}`, 10);
  const subOrderTime = formatTimestamp(timestamp, 'dd/MM/yyyy');
  const reviewImages = subOrderReviewListing.getImages();
  const {
    detailRating = {},
    generalRating,
    detailTextRating,
    replies = [],
  } = subOrderReviewListing.getMetadata();
  const { food, packaging } = detailRating;
  useEffect(() => {
    if (reviewId) {
      dispatch(SubOrdersThunks.fetchReviewFromSubOrder(reviewId));
    }
  }, [dispatch, reviewId]);

  return (
    <Modal
      id="SubOrderReviewModal"
      isOpen={isOpen}
      handleClose={onClose}
      className={css.modal}
      closeClassName={css.closedModal}
      containerClassName={css.modalContainer}
      title={
        isMobileLayout
          ? undefined
          : intl.formatMessage({ id: 'danh-gia-chi-tiet-0' })
      }
      shouldHideIconClose={isMobileLayout}>
      <RenderWhen condition={fetchReviewInProgress || isEmpty(subOrderReview)}>
        <div className={css.loading}>
          <IconSpinner />
        </div>
        <RenderWhen.False>
          <div
            style={{
              maxHeight: isMobileLayout ? '90vh' : '70vh',
              overflowY: 'auto',
              scrollbarWidth: 'thin',
              scrollbarColor: '#d1d5db #fff',
            }}
            className="scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
            <div className={css.goBack} onClick={onClose}>
              <IconArrow direction="left" />
              <span>
                {intl.formatMessage({
                  id: 'booker.orders.draft.foodDetailModal.back',
                })}
              </span>
            </div>
            <div className={css.restaurantInfor}>
              <div className={css.leftSide}>
                <div className={css.imageWrapper}>
                  <ResponsiveImage
                    variants={[EImageVariants.squareSmall2x]}
                    alt={foodName}
                    image={foodImage}
                    className={css.image}
                  />
                </div>
              </div>
              <div className={css.rightSide}>
                <div className={css.inforSection}>
                  <div className={css.restaurantName}>{restaurantName}</div>
                  <div className={css.dishName}>{foodName}</div>
                </div>
                <div className={css.rating}>
                  <IconRatingFace
                    rating={generalRating}
                    className={css.iconFace}
                  />
                  <div className={css.ratingText}>
                    {intl.formatMessage(
                      {
                        id: `FieldRating.label.${generalRating}`,
                      },
                      {
                        defaultValue: '...',
                      },
                    )}
                  </div>
                </div>
                <div className={css.time}>{subOrderTime}</div>
              </div>
            </div>
            <RenderWhen condition={!!food?.rating || !!packaging?.rating}>
              <div className={css.reviewInfor}>
                {!!food?.rating && (
                  <div className={css.rating}>
                    <IconRatingFace
                      rating={+food.rating}
                      className={css.iconFace}
                    />
                    <div className={css.ratingText}>
                      <span>Món ăn: </span>
                      {intl.formatMessage({
                        id: `FieldRating.label.${food?.rating}`,
                      })}
                    </div>
                  </div>
                )}
                {!!packaging?.rating && (
                  <div className={css.rating}>
                    <IconRatingFace
                      rating={+packaging.rating}
                      className={css.iconFace}
                    />
                    <div className={css.ratingText}>
                      <span>Dụng cụ: </span>
                      {intl.formatMessage({
                        id: `FieldRating.label.${packaging?.rating}`,
                      })}
                    </div>
                  </div>
                )}
              </div>
            </RenderWhen>
            <div className={css.detailReview}>{detailTextRating}</div>
            <RenderWhen condition={reviewImages.length > 0}>
              <div className={css.imageList}>
                {reviewImages.map((image: TImage) => (
                  <div key={image.id.uuid} className={css.imageWrapper}>
                    <ResponsiveImage
                      alt=""
                      image={image}
                      className={css.reviewImage}
                      variants={[EImageVariants.landscapeCrop2x]}
                    />
                  </div>
                ))}
              </div>
            </RenderWhen>
            {replies && replies.length > 0 && (
              <div className="mt-3 pl-12 border-l border-gray-300">
                {replies.map((reply: TReviewReply) => (
                  <div
                    key={reply.id || `${reply.repliedAt}-${reply.authorId}`}
                    className="mb-2">
                    <div className="flex items-start gap-2 mb-1">
                      <div className="w-6 h-6 bg-[#ef3d2a] rounded-full flex items-center justify-center text-white text-xs font-semibold">
                        {reply.authorName?.charAt(0) || 'U'}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-gray-500 font-semibold text-sm">
                          {reply.authorName || 'NA'}
                        </span>
                        {reply.replyRole && renderReplyRole(reply.replyRole)}
                      </div>
                    </div>
                    <p className="text-gray-700 text-sm leading-relaxed ml-8 whitespace-pre-line break-words">
                      {reply.replyContent}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </RenderWhen.False>
      </RenderWhen>
    </Modal>
  );
};

export default SubOrderReviewModal;
