import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { AlertCircleIcon } from 'lucide-react';

import {
  getChecklistBookerApi,
  updateChecklistClientSignatureApi,
} from '@apis/orderApi';
import LoadingContainer from '@components/LoadingContainer/LoadingContainer';
import type { ChecklistListing } from '@src/types';
import { HttpStatus } from '@src/utils/response';

import type { BookerChecklistSignatureFormValues } from './_components/BookerChecklistSignatureForm';
import { BookerChecklistSignatureForm } from './_components/BookerChecklistSignatureForm';

interface CheckListPageProps {
  orderId: string;
  subOrderDate: string;
}

const CheckListPage = ({ orderId, subOrderDate }: CheckListPageProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistListing | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchChecklist = async () => {
      try {
        setIsLoading(true);
        const res = await getChecklistBookerApi(orderId, subOrderDate);
        if (res?.data?.data) {
          setChecklist(res.data.data);
        } else {
          setChecklist(null);
        }
      } catch (error) {
        console.error('Error fetching checklist:', error);
        setChecklist(null);
      } finally {
        setIsLoading(false);
      }
    };

    if (orderId && subOrderDate) {
      fetchChecklist();
    }
  }, [orderId, subOrderDate]);

  const handleSubmit = async (values: BookerChecklistSignatureFormValues) => {
    try {
      setIsSubmitting(true);
      const res = await updateChecklistClientSignatureApi(
        orderId,
        subOrderDate,
        values,
      );
      if (res.status === HttpStatus.OK && res.data?.data) {
        toast.success('Ký tên thành công');
        setChecklist(res.data.data);
      } else {
        toast.error('Có lỗi xảy ra khi lưu chữ ký');
      }
    } catch (error) {
      console.error('Error saving signature:', error);
      toast.error('Có lỗi xảy ra khi lưu chữ ký');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isSigned =
    !!checklist?.attributes?.metadata?.clientSignature &&
    !!checklist?.attributes?.metadata?.clientNameSignature;

  if (isLoading) {
    return <LoadingContainer />;
  }

  if (!checklist) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-white">
        <div className="flex flex-col items-center justify-center gap-4 p-6">
          <AlertCircleIcon className="w-10 h-10 text-amber-500" />
          <p className="text-xl font-semibold text-center text-gray-700">
            Chưa có biên bản bàn giao cho đơn hàng này
          </p>
          <p className="text-sm text-center text-gray-500">
            Vui lòng chờ vận hành hoàn thành biên bản trước khi ký tên
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-gray-50">
      <BookerChecklistSignatureForm
        checkList={checklist}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        isSigned={isSigned}
      />
    </div>
  );
};

export default CheckListPage;
