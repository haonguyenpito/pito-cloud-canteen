import React, { useEffect, useState } from 'react';
import { shallowEqual } from 'react-redux';
import { toast } from 'react-toastify';
import { AlertCircleIcon } from 'lucide-react';

import LoadingContainer from '@components/LoadingContainer/LoadingContainer';
import { useAppDispatch, useAppSelector } from '@hooks/reduxHooks';
import useCheckListForm from '@hooks/useCheckListForm';
import { orderManagementThunks } from '@redux/slices/OrderManagement.slice';
import type { ChecklistListing } from '@src/types';
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
      if (res) {
        setChecklist(res);
      }
    } catch (error) {
      console.error('Error saving checklist:', error);
      toast.error('Có lỗi xảy ra khi lưu checklist');
    } finally {
      setIsSubmitting(false);
    }
    toast.success('Lưu checklist thành công');
  };

  const isPageLoading = isLoading || isGetChecklistLoading;

  return (
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
  );
};

export default CheckListPage;
