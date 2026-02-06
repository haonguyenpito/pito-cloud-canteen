import React, { useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { toast } from 'react-toastify';
import { CheckIcon, MessageCircle, SendIcon, XIcon } from 'lucide-react';

import IconRatingFace from '@components/Icons/IconRatingFace/IconRatingFace';
import Modal from '@components/Modal/Modal';
import Tooltip from '@components/Tooltip/Tooltip';
import { renderReplyRole, renderStars } from '@helpers/review/ui';
import { useAppDispatch, useAppSelector } from '@hooks/reduxHooks';
import Spinner from '@pages/company/booker/orders/new/quiz/meal-date/Spinner';
import { processReply } from '@redux/slices/Reviews.admin.slice';
import { currentUserSelector } from '@redux/slices/user.slice';
import type { RatingListing } from '@src/types';
import { CurrentUser } from '@src/utils/data';
import { formatTimestamp } from '@src/utils/dates';
import { EUserRole } from '@src/utils/enums';

interface ReviewCardProps {
  review: RatingListing & { authorName: string };
  isSubmittingReply?: boolean;
  isDisabledReply?: boolean;
  onReply?: ({
    reviewId,
    replyRole,
    replyContent,
  }: {
    reviewId: string;
    replyRole: EUserRole;
    replyContent: string;
  }) => void;
}

const ReviewCard = ({
  review,
  onReply,
  isSubmittingReply,
  isDisabledReply = false,
}: ReviewCardProps) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showAllImages, setShowAllImages] = useState(false);
  const [previewSrc, setPreviewSrc] = useState<string>('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [processingReplyId, setProcessingReplyId] = useState<string | null>(
    null,
  );

  const MAX_IMAGES_TO_SHOW = 4;
  const currentUser = useAppSelector(currentUserSelector);

  const currentUserGetter = CurrentUser(currentUser);
  const { isAdmin, isBooker, isPartner } = currentUserGetter.getMetadata();

  // eslint-disable-next-line prettier/prettier
  const role = isAdmin ? EUserRole.admin : isBooker ? EUserRole.booker : isPartner ? EUserRole.partner : EUserRole.participant;

  const handleReplySubmit = async () => {
    if (!replyText.trim() || isDisabledReply) return;
    try {
      onReply?.({
        reviewId: review.id?.uuid || '',
        replyRole: role,
        replyContent: replyText,
      });
      setReplyText('');
      setShowReplyInput(false);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleReplyCancel = () => {
    setReplyText('');
    setShowReplyInput(false);
  };

  const reviewInformation = review.attributes?.metadata || {};
  const authorName = review.authorName || '';
  const replies =
    reviewInformation.replies?.filter((reply) => reply !== undefined) || [];

  const isPartnerAlreadyReplied = replies.some(
    (reply) =>
      reply.replyRole === EUserRole.partner &&
      reply.authorId === currentUser?.id?.uuid,
  );

  const handleProcessReply = async (
    replyId: string,
    action: 'approved' | 'rejected',
  ) => {
    try {
      if (!review.id?.uuid) return;
      setProcessingReplyId(replyId);
      await dispatch(
        processReply({
          reviewId: review.id.uuid,
          replyId,
          status: action,
        }),
      ).unwrap();
      toast.success(
        action === 'approved'
          ? intl.formatMessage({ id: 'ReviewCard.approvedReply' })
          : intl.formatMessage({ id: 'ReviewCard.rejectedReply' }),
      );
    } catch (error) {
      toast.error(
        (error as Error).message ||
          intl.formatMessage({ id: 'ReviewCard.errorProcessingReply' }),
      );
    } finally {
      setProcessingReplyId(null);
    }
  };
  const images = Array.isArray(review.images)
    ? (review.images || []).filter((img) => !!img)
    : [];

  const isAdminView = role === EUserRole.admin;
  const isPartnerView = role === EUserRole.partner;
  const isPartnerCanReply = !isPartnerAlreadyReplied && isPartnerView;

  const shouldShowReplyButton =
    (!isDisabledReply && !isPartnerView) || isPartnerCanReply;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
      {/* Review Header */}
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="w-7 h-7 bg-gradient-to-br bg-[#ef3d2a] rounded-full flex items-center justify-center text-white font-semibold text-sm">
          {authorName.charAt(0).toUpperCase()}
        </div>

        {/* Review Content */}
        <div className="flex-1">
          {/* Name and Time */}
          <div className="flex items-center gap-2">
            <span className="text-gray-500 font-semibold text-sm">
              {authorName}
            </span>
          </div>
          <span className="bg-white text-gray-500 pe-2 py-1 text-xs items-center gap-1">
            Đã đặt món:{' '}
            <span className="font-bold">
              {reviewInformation.foodName}{' '}
              {reviewInformation.secondaryFoodName &&
                `+ ${reviewInformation.secondaryFoodName}`}
            </span>{' '}
            vào{' '}
            <span className="font-bold">
              {formatTimestamp(reviewInformation.timestamp, 'dd/MM/yyyy')}
            </span>
          </span>

          {/* Rating */}
          <div className="grid md:grid-cols-[auto,1fr] w-fit grid-cols-1 gap-2 items-center mb-1">
            <div className="flex w-fit gap-1 items-center">
              {reviewInformation.generalRating &&
                renderStars(reviewInformation.generalRating)}
            </div>
            <span className="text-gray-500 text-xs font-bold">
              #{reviewInformation.orderCode}
            </span>
          </div>
          <div className="flex gap-2 items-center mb-1">
            <span className="bg-white pe-2 py-1 text-sm flex items-center gap-1">
              {reviewInformation.detailRating?.food?.rating &&
              reviewInformation.detailRating?.food?.rating > 0 ? (
                <>
                  <FormattedMessage id="ReviewCard.foodRatingLabel" />{' '}
                  <IconRatingFace
                    className="w-5 h-5"
                    rating={reviewInformation.detailRating?.food?.rating}
                  />
                </>
              ) : null}
            </span>
            <span className="bg-white pe-2 flex py-1 text-sm items-center gap-1">
              {reviewInformation.detailRating?.packaging?.rating &&
              reviewInformation.detailRating?.packaging?.rating > 0 ? (
                <>
                  <FormattedMessage id="ReviewCard.packagingRatingLabel" />{' '}
                  <IconRatingFace
                    className="w-5 h-5"
                    rating={reviewInformation.detailRating?.packaging?.rating}
                  />
                </>
              ) : null}
            </span>
          </div>
          {/* Comment */}
          <p className="text-black font-bold text-sm leading-relaxed mb-1">
            {reviewInformation.detailTextRating}
          </p>

          {/* Attached Images */}
          {images.length > 0 && (
            <div className="mt-3 mb-1">
              <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
                {(showAllImages
                  ? images
                  : images.slice(0, MAX_IMAGES_TO_SHOW)
                ).map((image) => {
                  if (!image) return null;
                  const variants = image.attributes?.variants || ({} as any);
                  const src =
                    variants['landscape-crop2x']?.url ||
                    variants['landscape-crop']?.url ||
                    variants['square-small2x']?.url ||
                    variants['square-small']?.url ||
                    variants['landscape-crop4x']?.url ||
                    variants['landscape-crop6x']?.url ||
                    (variants as any)?.default?.url ||
                    '';
                  if (!src) return null;

                  const onClickImage = (e: React.MouseEvent) => {
                    e.preventDefault();
                    setPreviewSrc(src);
                    setIsPreviewOpen(true);
                  };

                  return (
                    <button
                      key={image.id?.uuid || src}
                      onClick={onClickImage}
                      type="button"
                      className="block focus:outline-none">
                      <img
                        src={src}
                        alt="review-image"
                        className="w-full h-24 md:h-28 object-cover rounded border"
                      />
                    </button>
                  );
                })}
              </div>
              {images.length > MAX_IMAGES_TO_SHOW && (
                <div className="mt-2">
                  <button
                    type="button"
                    className="text-sm text-blue-600 hover:text-blue-700"
                    onClick={() => setShowAllImages((v) => !v)}>
                    {showAllImages ? (
                      <FormattedMessage id="ReviewCard.collapseImages" />
                    ) : (
                      <FormattedMessage
                        id="ReviewCard.viewMoreImages"
                        values={{
                          count: images.length - MAX_IMAGES_TO_SHOW,
                        }}
                      />
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          {shouldShowReplyButton && (
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowReplyInput(!showReplyInput)}
                className="flex items-center gap-1 text-gray-600 hover:text-blue-600 transition-colors">
                <MessageCircle className="w-4 h-4" />
                <span className="text-sm">
                  <FormattedMessage id="ReviewCard.replyButton" />
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Inline Reply Input */}
      {showReplyInput && (
        <div className="mt-3 pl-12 border-l border-gray-300">
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder={intl.formatMessage({
              id: 'ReviewCard.replyPlaceholder',
            })}
            className="w-full p-2 border border-gray-300 bg-gray-50 rounded text-sm resize-none focus:ring-1 focus:ring-black focus:border-black"
            rows={3}
            disabled={isSubmittingReply}
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={handleReplyCancel}
              disabled={isSubmittingReply}
              className="px-3 py-1 text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50 text-sm">
              <FormattedMessage id="ReviewCard.cancelButton" />
            </button>
            <button
              type="button"
              onClick={handleReplySubmit}
              disabled={!replyText.trim() || isSubmittingReply}
              className="px-3 py-1 bg-black text-white rounded hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm">
              {isSubmittingReply ? (
                <FormattedMessage id="ReviewCard.sendingReply" />
              ) : (
                <SendIcon className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      )}

      {replies && replies.length > 0 && (
        <div className="mt-3 pl-12 border-l border-gray-300">
          {replies.map((reply) => (
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
                {isAdminView && reply.status === 'pending' && (
                  <div className="flex items-center gap-2">
                    {processingReplyId === reply.id ? (
                      <span className="text-gray-500 text-sm flex items-center gap-2">
                        <Spinner className="w-4 h-4 text-gray-500" />
                        <span className="text-gray-500 text-xs">
                          <FormattedMessage id="ReviewCard.processing" />
                        </span>
                      </span>
                    ) : (
                      <>
                        <Tooltip
                          tooltipContent={intl.formatMessage({
                            id: 'ReviewCard.approveReplyTooltip',
                          })}
                          placement="top">
                          <button
                            type="button"
                            disabled={processingReplyId === reply.id}
                            onClick={() =>
                              handleProcessReply(reply.id as string, 'approved')
                            }
                            className="px-2 py-1 rounded border border-green-600 text-green-700 hover:bg-green-50 disabled:opacity-50">
                            <CheckIcon className="w-4 h-4" />
                          </button>
                        </Tooltip>
                        <Tooltip
                          tooltipContent={intl.formatMessage({
                            id: 'ReviewCard.rejectReplyTooltip',
                          })}
                          placement="top">
                          <button
                            type="button"
                            disabled={processingReplyId === reply.id}
                            onClick={() =>
                              handleProcessReply(reply.id as string, 'rejected')
                            }
                            className="px-2 py-1 rounded border border-red-600 text-red-700 hover:bg-red-50 disabled:opacity-50">
                            <XIcon className="w-4 h-4" />
                          </button>
                        </Tooltip>
                      </>
                    )}
                  </div>
                )}
              </div>
              <p className="text-gray-700 text-sm leading-relaxed ml-8 whitespace-pre-line break-words">
                {reply.replyContent}
              </p>
              {isPartnerView && reply.status === 'pending' && (
                <p className="text-gray-500 italic text-[10px] leading-relaxed ml-8">
                  <FormattedMessage id="ReviewCard.partnerPendingMessage" />
                </p>
              )}
              {isPartnerView && reply.status === 'rejected' && (
                <p className="text-gray-500 italic text-[10px] font-semibold leading-relaxed ml-8">
                  <FormattedMessage id="ReviewCard.partnerRejectedMessage" />
                </p>
              )}
              {isAdminView && reply.status === 'pending' && (
                <p className="text-gray-500 italic text-[10px] leading-relaxed ml-8">
                  <FormattedMessage id="ReviewCard.adminPendingMessage" />
                </p>
              )}
            </div>
          ))}
        </div>
      )}
      {/* Image Preview Modal */}
      <Modal
        isOpen={isPreviewOpen}
        handleClose={() => setIsPreviewOpen(false)}
        title={intl.formatMessage({ id: 'ReviewCard.imagePreviewTitle' })}
        shouldFullScreenInMobile
        shouldHideGreyBackground={false}>
        <div className="p-2 flex items-center justify-center">
          {previewSrc && (
            <img
              src={previewSrc}
              alt="preview"
              className="max-h-[80vh] w-auto max-w-full object-contain"
            />
          )}
        </div>
      </Modal>
    </div>
  );
};
export default ReviewCard;
