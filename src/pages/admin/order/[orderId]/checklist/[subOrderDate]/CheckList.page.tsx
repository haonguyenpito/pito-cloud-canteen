import React, { useEffect, useState } from 'react';
import { shallowEqual } from 'react-redux';
import { toast } from 'react-toastify';
import { AlertCircleIcon } from 'lucide-react';

import LoadingContainer from '@components/LoadingContainer/LoadingContainer';
import { useAppDispatch, useAppSelector } from '@hooks/reduxHooks';
import useCheckListForm from '@hooks/useCheckListForm';
import { orderManagementThunks } from '@redux/slices/OrderManagement.slice';
import { companyPaths } from '@src/paths';
import type { ChecklistListing } from '@src/types';
import { Listing } from '@src/utils/data';
import { HttpStatus } from '@src/utils/response';
import type { ChecklistImage } from '@utils/types';

import type { FoodHandoverChecklistFormValues } from './_components/FoodHandoverChecklistForm';
import { FoodHandoverChecklistForm } from './_components/FoodHandoverChecklistForm';

interface CheckListPageProps {
  orderId: string;
  subOrderDate: string;
}
const CheckListPage = ({ orderId, subOrderDate }: CheckListPageProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistListing | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [checklistShareLink, setChecklistShareLink] = useState('');
  const dispatch = useAppDispatch();
  const { createChecklist, getChecklist, isGetChecklistLoading } =
    useCheckListForm(orderId, subOrderDate);
  const order = useAppSelector(
    (state) => state.AdminManageOrder.order,
    shallowEqual,
  );

  const isLoading = useAppSelector((state) => {
    return state.AdminManageOrder.fetchOrderInProgress;
  }, shallowEqual);
  const orderDetail = useAppSelector((state) => {
    return state.AdminManageOrder.orderDetail;
  }, shallowEqual);

  useEffect(() => {
    const fetchChecklist = async () => {
      try {
        const res = await getChecklist();
        if (res) {
          setChecklist(res);
        }
      } catch (error) {
        console.error('Error fetching checklist:', error);
      }
    };

    if (orderId && subOrderDate) {
      fetchChecklist();
    }
  }, [getChecklist, orderId, subOrderDate]);

  useEffect(() => {
    if (orderId) {
      dispatch(
        orderManagementThunks.loadData({
          orderId: orderId as string,
          isAdminFlow: true,
        }),
      );
    }
  }, [dispatch, orderId]);

  const handleSubmit = async (values: FoodHandoverChecklistFormValues) => {
    try {
      setIsSubmitting(true);
      // Transform images from ImageItem[] to ChecklistImage[]
      const images: ChecklistImage[] = (values.images || [])
        .filter(
          (img) => img.state === 'uploaded' && img.imageUrl && img.imageId,
        )
        .map((img) => ({
          imageUrl: img.imageUrl!,
          imageId: img.imageId!,
          uploadedAt: Date.now(),
        }));

      // Transform dates to ISO strings for API
      const apiBody = {
        ...values,
        implementationDate: values.implementationDate.toISOString(),
        recordedTime: values.recordedTime.toISOString(),
        foodTakenOutTime: values.foodTakenOutTime.toISOString(),
        foodSafetyTime: values.foodSafetyTime.toISOString(),
        images,
        partnerSignature: values.partnerSignature || undefined,
        partnerNameSignature: values.partnerNameSignature || undefined,
        clientSignature: values.clientSignature || undefined,
        clientNameSignature: values.clientNameSignature || undefined,
      };

      const res = await createChecklist(apiBody);
      if (res.status === HttpStatus.CREATED) {
        const link = `${
          process.env.NEXT_PUBLIC_CANONICAL_URL
        }${companyPaths.Checklist.replace('[orderId]', orderId).replace(
          '[subOrderDate]',
          subOrderDate,
        )}`;
        setChecklistShareLink(link);
        setIsShareModalOpen(true);
        toast.success(
          'Xác nhận biên bản thành công. Vui lòng chia sẻ link biên bản cho khách hàng',
        );

        getChecklist().then((data) => {
          if (data) {
            setChecklist(data);
          }
        });
      } else {
        toast.error('Có lỗi xảy ra khi lưu checklist');
      }
    } catch (error) {
      console.error('Error saving checklist:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyChecklistLink = async () => {
    if (!checklistShareLink) return;

    try {
      await navigator.clipboard.writeText(checklistShareLink);
      toast.success('Đã sao chép link biên bản xác nhận');
    } catch (error) {
      console.error('Error copying checklist link:', error);
      toast.error('Không thể sao chép link, vui lòng thử lại');
    }
  };

  const isPageLoading =
    isLoading ||
    isGetChecklistLoading ||
    !order ||
    Listing(order).getId() !== orderId;

  return (
    <>
      <div className="w-full min-h-screen bg-gray-50">
        {isPageLoading ? (
          <LoadingContainer />
        ) : !orderDetail?.[subOrderDate] ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white">
            <div className="flex flex-col items-center justify-center gap-4">
              <AlertCircleIcon className="w-10 h-10 text-red-500" />
              <p className="text-2xl font-bold">
                Không tìm thấy chi tiết đơn hàng cho ngày này
              </p>
            </div>
          </div>
        ) : (
          <FoodHandoverChecklistForm
            isSubmitting={isSubmitting}
            subOrderDate={subOrderDate}
            orderDetail={orderDetail}
            order={order}
            onSubmit={handleSubmit}
            isCreated={!!checklist}
            checkList={checklist || undefined}
          />
        )}
      </div>

      {isShareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-lg">
            <h2 className="mb-3 text-lg font-semibold">
              Chia sẻ biên bản xác nhận
            </h2>
            <p className="mb-4 text-sm text-gray-600">
              Gửi đường link dưới đây cho khách hàng để xem biên bản xác nhận.
            </p>
            <div className="mb-4 flex items-center gap-2">
              <p className="text-sm text-gray-600 bg-gray-100 p-2 rounded">
                {checklistShareLink}
              </p>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleCopyChecklistLink}
                className="rounded bg-black px-3 py-2 text-sm font-medium text-white hover:bg-gray-800">
                Sao chép
              </button>
              <button
                type="button"
                onClick={() => setIsShareModalOpen(false)}
                className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CheckListPage;
