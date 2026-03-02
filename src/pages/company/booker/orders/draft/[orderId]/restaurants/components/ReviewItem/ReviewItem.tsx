import { useState } from 'react';
import { useIntl } from 'react-intl';
import classNames from 'classnames';

import Avatar from '@components/Avatar/Avatar';
import IconRatingFace from '@components/Icons/IconRatingFace/IconRatingFace';
import { renderReplyRole } from '@helpers/review/ui';
import type { TReviewReply, UserListing } from '@src/types';
import { formatTimestamp } from '@src/utils/dates';
import { buildFullName } from '@src/utils/emailTemplate/participantOrderPicking';

import { converRatingPointToLabel } from '../../helpers/review';

import css from './ReviewItem.module.scss';

type ReviewItemProps = {
  generalRating: number;
  detailRating?: {
    food?: {
      rating?: number;
    };
    packaging?: {
      rating?: number;
      optionalOtherReview?: string;
    };
  };
  timestamp?: number;
  user: UserListing;
  foodName?: string;
  detailTextRating?: string;
  reviewAt?: Date;
  replies?: TReviewReply[];
};

const ReviewItem: React.FC<ReviewItemProps> = (props) => {
  const {
    generalRating,
    detailRating,
    user,
    timestamp,
    foodName,
    detailTextRating,
    replies = [],
  } = props;
  const intl = useIntl();
  const [isRepliesExpanded, setIsRepliesExpanded] = useState(false);

  const { food, packaging } = detailRating || {};
  const validReplies = replies?.filter((r): r is TReviewReply => !!r) ?? [];
  const visibleReplies =
    isRepliesExpanded || validReplies.length <= 2
      ? validReplies
      : validReplies.slice(0, 2);
  const hasMoreReplies = validReplies.length > 2;

  return (
    <div className={css.container}>
      <Avatar user={user} className={css.avatar} />
      <div className={css.reviewWrapper}>
        <div className={css.reviewerName}>
          {buildFullName(
            user.attributes?.profile?.firstName,
            user.attributes?.profile?.lastName,
            {
              compareToGetLongerWith: user.attributes?.profile?.displayName,
            },
          )}
        </div>
        <div className={css.generalRating}>
          {converRatingPointToLabel(generalRating)}
        </div>
        <div className={css.detailRating}>
          <IconRatingFace className={css.faceIcon} rating={food?.rating || 0} />
          <div className={css.label}>
            {intl.formatMessage({ id: 'AddOrderForm.foodIdField.placeholder' })}
            :{' '}
          </div>
          <div className={css.value}>
            {converRatingPointToLabel(food?.rating || 0)}
          </div>
        </div>
        <div className={css.detailRating}>
          <IconRatingFace
            className={css.faceIcon}
            rating={packaging?.rating || 0}
          />
          <div className={css.label}>
            {intl.formatMessage({
              id: 'ManagePartnerReviewsPage.packageTitle',
            })}
            :{' '}
          </div>
          <div className={css.value}>
            {converRatingPointToLabel(packaging?.rating || 0)}
          </div>
        </div>
        {packaging?.optionalOtherReview && (
          <div className={css.textReview}>{packaging?.optionalOtherReview}</div>
        )}
        {detailTextRating && (
          <div className={classNames(css.textReview, css.detailTextRating)}>
            {detailTextRating}
          </div>
        )}
        {foodName && (
          <div className={classNames(css.textReview, css.foodName)}>
            Đã đặt món: <span>{foodName} •</span>{' '}
            {formatTimestamp(timestamp, 'dd/MM/yyyy')}
          </div>
        )}
        {validReplies.length > 0 && (
          <div className={css.repliesSection}>
            {visibleReplies.map((reply, idx) => (
              <div
                key={reply.id ?? `${reply.repliedAt}-${reply.authorId}-${idx}`}
                className={css.replyItem}>
                <div className="flex flex-col items-start mb-1">
                  <span className="text-gray-500 font-semibold text-sm">
                    {reply.authorName || 'NA'}
                  </span>
                  {reply.replyRole && renderReplyRole(reply.replyRole)}
                </div>
                <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line break-words">
                  {reply.replyContent}
                </p>
              </div>
            ))}
            {hasMoreReplies && (
              <button
                type="button"
                className={css.replyToggle}
                onClick={() => setIsRepliesExpanded((prev) => !prev)}>
                {isRepliesExpanded
                  ? intl.formatMessage({
                      id: 'BookerRatingSection.collapseReplies',
                      defaultMessage: 'Thu gọn phản hồi',
                    })
                  : intl.formatMessage({
                      id: 'BookerRatingSection.showMoreReplies',
                      defaultMessage: 'Xem thêm phản hồi',
                    })}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewItem;
