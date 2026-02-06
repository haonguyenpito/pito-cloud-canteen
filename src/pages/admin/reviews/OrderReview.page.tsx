import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { MessageCircle, MessageCircleReply } from 'lucide-react';

import RatingReview from '@components/RatingReview/RatingReview';
import { useAppDispatch, useAppSelector } from '@hooks/reduxHooks';
import {
  fetchPendingReplyReviews,
  fetchReviews,
  setFilters,
  submitReply,
} from '@redux/slices/Reviews.admin.slice';
import { currentUserSelector } from '@redux/slices/user.slice';
import type { EUserRole } from '@src/utils/enums';

type TTab = 'reviews' | 'pending';

const OrderReviewPage = () => {
  const dispatch = useAppDispatch();
  const {
    reviews,
    partnerReplyPendingReviews,
    partnerReplyPendingPagination,
    pagination,
    fetchReviewsInProgress,
    fetchPendingReplyReviewsInProgress,
    submitReplyInProgress,
    fetchReviewsError,
    fetchPendingReplyReviewsError,
    filters,
  } = useAppSelector((state) => state.adminReviews);
  const FIRST_PAGE = 1;
  const [page, setPage] = useState<{ reviews: number; pending: number }>({
    reviews: FIRST_PAGE,
    pending: FIRST_PAGE,
  });
  const [tab, setTab] = useState<TTab>('reviews');
  const currentUser = useAppSelector(currentUserSelector);
  const totalReviews = pagination.totalItems;
  const filtersRef = useRef(filters);

  // Keep filtersRef in sync with filters
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  // Fetch reviews on component mount
  useEffect(() => {
    dispatch(fetchReviews({}));
  }, [dispatch]);

  useEffect(() => {
    dispatch(fetchPendingReplyReviews({}));
  }, [dispatch]);

  const handleSearch = useCallback(
    (orderCode: string) => {
      const trimmedOrderCode = orderCode.trim();
      const newOrderCode = trimmedOrderCode || undefined;
      const newFilters = { ...filtersRef.current, orderCode: newOrderCode };
      dispatch(setFilters({ orderCode: newOrderCode }));
      dispatch(fetchReviews({ ...newFilters, page: 1 }));
      dispatch(fetchPendingReplyReviews({ ...newFilters, page: 1 }));
      setPage({ reviews: 1, pending: 1 });
    },
    [dispatch],
  );

  const handleFilterRating = useCallback(
    (ratings: number[]) => {
      const newFilters = { ...filtersRef.current, ratings };
      dispatch(setFilters({ ratings }));
      dispatch(fetchReviews({ ...newFilters, page: 1 }));
      dispatch(fetchPendingReplyReviews({ ...newFilters, page: 1 }));
      setPage({ reviews: 1, pending: 1 });
    },
    [dispatch],
  );

  const handleReply = useCallback(
    async ({
      reviewId,
      replyRole,
      replyContent,
    }: {
      reviewId: string;
      replyRole: EUserRole;
      replyContent: string;
    }) => {
      const adminName = 'PITO Cloud Canteen';
      try {
        await dispatch(
          submitReply({
            reviewId,
            replyRole,
            replyContent,
            authorId: currentUser?.id?.uuid || '',
            authorName: adminName,
          }),
        );
      } catch (error) {
        console.error('Error submitting reply:', error);
        toast.error((error as Error).message);
      }
    },
    [dispatch, currentUser?.id?.uuid],
  );

  const handlePageChange = useCallback(
    (newPage: number, pageSize: number) => {
      if (tab === 'pending') {
        setPage((prev) => ({ ...prev, pending: newPage }));
        dispatch(
          fetchPendingReplyReviews({
            ...filtersRef.current,
            page: newPage,
            limit: pageSize,
          }),
        );
      } else {
        setPage((prev) => ({ ...prev, reviews: newPage }));
        dispatch(
          fetchReviews({
            ...filtersRef.current,
            page: newPage,
            limit: pageSize,
          }),
        );
      }
    },
    [dispatch, tab],
  );

  const handleTabChange = useCallback((nextTab: TTab) => {
    setTab(nextTab);
  }, []);

  const displayedReviews =
    tab === 'pending' ? partnerReplyPendingReviews : reviews;
  const displayedPagination =
    tab === 'pending' ? partnerReplyPendingPagination : pagination;
  const displayedFetchInProgress =
    tab === 'pending'
      ? fetchPendingReplyReviewsInProgress
      : fetchReviewsInProgress;
  const displayedFetchError =
    tab === 'pending' ? fetchPendingReplyReviewsError : fetchReviewsError;
  const activePage = tab === 'pending' ? page.pending : page.reviews;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Quản lý đánh giá đơn hàng
        </h1>
        <p className="text-gray-600">
          Xem và trả lời các đánh giá từ khách hàng về dịch vụ đặt món
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div
          className={`bg-white rounded-lg border p-6 transition cursor-pointer ${
            tab === 'reviews'
              ? 'border-blue-500 shadow-lg'
              : 'border-gray-200 hover:border-gray-300'
          }`}
          role="button"
          tabIndex={0}
          onClick={() => handleTabChange('reviews')}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              handleTabChange('reviews');
            }
          }}>
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <MessageCircle className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Tổng đánh giá</p>
              <p className="text-2xl font-bold text-gray-900">{totalReviews}</p>
            </div>
          </div>
        </div>
        <div
          className={`bg-white rounded-lg border p-6 transition cursor-pointer ${
            tab === 'pending'
              ? 'border-yellow-500 shadow-lg'
              : 'border-gray-200 hover:border-gray-300'
          }`}
          role="button"
          tabIndex={0}
          onClick={() => handleTabChange('pending')}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              handleTabChange('pending');
            }
          }}>
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <MessageCircleReply className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">
                Chờ duyệt phản hồi
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {partnerReplyPendingPagination.totalItems}
              </p>
            </div>
          </div>
        </div>
      </div>

      <RatingReview
        reviews={displayedReviews}
        fetchReviewsInProgress={displayedFetchInProgress}
        fetchReviewsError={displayedFetchError}
        submitReplyInProgress={submitReplyInProgress}
        pagination={displayedPagination}
        page={activePage}
        handleFilterRating={handleFilterRating}
        handleReply={handleReply}
        handleSearch={handleSearch}
        handlePageChange={handlePageChange}
        isShowFilters={true}
        selectedRatings={filters.ratings}
      />
    </div>
  );
};

export default OrderReviewPage;
