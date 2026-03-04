import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import classNames from 'classnames';
import { format } from 'date-fns';
import { Loader2Icon } from 'lucide-react';
import { z } from 'zod';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@components/ui/alert-dialog';
import { Button } from '@components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@components/ui/form';
import { Input } from '@components/ui/input';
import { SignatureField } from '@pages/admin/order/[orderId]/checklist/[subOrderDate]/_components/SignatureField';
import type { ChecklistListing } from '@src/types';
import type { ChecklistImage } from '@utils/types';

const isValidDate = (d: unknown): d is Date =>
  d instanceof Date && !Number.isNaN(d.getTime());

const toDateOrUndefined = (value: unknown): Date | undefined => {
  if (!value) return undefined;
  if (isValidDate(value)) return value;
  if (typeof value === 'number') {
    const d = new Date(value);

    return isValidDate(d) ? d : undefined;
  }
  if (typeof value === 'string') {
    const d = /^\d+$/.test(value) ? new Date(Number(value)) : new Date(value);

    return isValidDate(d) ? d : undefined;
  }

  return undefined;
};

const formatDateTime = (value: unknown): string => {
  const d = toDateOrUndefined(value);

  return d ? format(d, 'dd/MM/yyyy HH:mm') : '-';
};

const formatDate = (value: unknown): string => {
  const d = toDateOrUndefined(value);

  return d ? format(d, 'dd/MM/yyyy') : '-';
};

const formSchema = z.object({
  clientSignature: z.string().min(1, 'Vui lòng ký tên'),
  clientNameSignature: z.string().min(1, 'Vui lòng ghi rõ họ tên'),
});

export type BookerChecklistSignatureFormValues = z.infer<typeof formSchema>;

type BookerChecklistSignatureFormProps = {
  checkList: ChecklistListing;
  onSubmit: (
    values: BookerChecklistSignatureFormValues,
  ) => void | Promise<void>;
  isSubmitting?: boolean;
  isSigned?: boolean;
};

export const BookerChecklistSignatureForm = ({
  checkList,
  onSubmit,
  isSubmitting = false,
  isSigned = false,
}: BookerChecklistSignatureFormProps) => {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const metadata = checkList?.attributes?.metadata || {};
  const images: ChecklistImage[] = (metadata.images || []) as ChecklistImage[];

  const form = useForm<BookerChecklistSignatureFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      clientSignature: metadata.clientSignature || '',
      clientNameSignature: metadata.clientNameSignature || '',
    },
  });

  useEffect(() => {
    if (checkList) {
      form.reset({
        clientSignature: metadata.clientSignature || '',
        clientNameSignature: metadata.clientNameSignature || '',
      });
    }
  }, [checkList, form, metadata.clientSignature, metadata.clientNameSignature]);

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit(values);
    setIsConfirmOpen(false);
  });

  const handleOpenConfirm = async () => {
    const isValid = await form.trigger();
    if (isValid) {
      setIsConfirmOpen(true);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h2 className="text-2xl font-semibold text-center mb-8 text-gray-700">
        Biên bản bàn giao thức ăn sau phục vụ
      </h2>
      <Form {...form}>
        <form onSubmit={handleSubmit} className="w-full">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-6 md:gap-4 mb-8">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">
                1. Ngày triển khai <span className="text-red-500">*</span>
              </span>
              <p className="text-sm text-gray-700">
                {formatDate(metadata.implementationDate)}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">
                2. Thời gian ghi nhận <span className="text-red-500">*</span>
              </span>
              <p className="text-sm text-gray-700">
                {formatDateTime(metadata.recordedTime)}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">
                3. Tên nhân sự phụ trách <span className="text-red-500">*</span>
              </span>
              <p className="text-sm text-gray-700">
                {metadata.responsibleStaffName || '-'}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">
                4. Tên khách hàng (công ty khách){' '}
                <span className="text-red-500">*</span>
              </span>
              <p className="text-sm text-gray-700">
                {metadata.clientName || '-'}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">
                5. Mã đơn hàng <span className="text-red-500">*</span>
              </span>
              <p className="text-sm text-gray-700">
                {metadata.orderCode || '-'}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">
                6. Đối tác phụ trách đơn <span className="text-red-500">*</span>
              </span>
              <p className="text-sm text-gray-700">
                {metadata.partnerName || '-'}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">
                7. Thời gian thực phẩm đem ra khỏi nơi chế biến{' '}
                <span className="text-red-500">*</span>
              </span>
              <p className="text-sm text-gray-700">
                {formatDateTime(metadata.foodTakenOutTime)}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">
                8. Thời gian an toàn của thực phẩm{' '}
                <span className="text-red-500">*</span>
              </span>
              <p className="text-sm text-gray-700">
                {formatDateTime(metadata.foodSafetyTime)}
              </p>
            </div>

            <div
              className={classNames(
                'flex flex-col gap-2',
                'col-span-1 md:col-span-2',
              )}>
              <span className="text-sm font-medium">9. Ghi chú</span>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {metadata.note || '-'}
              </p>
            </div>

            {images.length > 0 && (
              <div
                className={classNames(
                  'flex flex-col gap-2',
                  'col-span-1 md:col-span-2',
                )}>
                <span className="text-sm font-medium">
                  10. Hình ảnh thực phẩm bàn giao
                </span>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                  {images.map((img, idx) => (
                    <div
                      key={img.imageId || idx}
                      className="aspect-square rounded-lg overflow-hidden border border-gray-200">
                      <img
                        src={img.imageUrl}
                        alt={`Ảnh ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Signature Section - 3 columns like admin, only Client editable */}
          <div className="mb-8 pt-6 border-t border-gray-300">
            <h3 className="text-lg font-semibold mb-4">Phần ký tên</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* QA/QC Column - read-only */}
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium">Nhân viên QA/QC</span>
                  <SignatureField
                    disabled
                    value={metadata.qaQcSignature || ''}
                    onChange={() => {}}
                    label="Ký tên"
                    required={false}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-xs text-gray-600">
                    (Ký tên và ghi rõ họ tên)
                  </span>
                  <Input
                    value={metadata.qaQcName || ''}
                    disabled
                    placeholder="Ghi rõ họ tên"
                    className="w-full"
                  />
                </div>
              </div>

              {/* Client Column - editable */}
              <div className="flex flex-col gap-4">
                <FormField
                  control={form.control}
                  name="clientSignature"
                  render={({ field }) => (
                    <FormItem className="flex flex-col gap-2">
                      <FormLabel className="text-sm font-medium">
                        Khách hàng <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <SignatureField
                          disabled={isSigned}
                          value={field.value || ''}
                          onChange={(signature) =>
                            field.onChange(signature ?? '')
                          }
                          label="Ký tên"
                          required
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="clientNameSignature"
                  render={({ field }) => (
                    <FormItem className="flex flex-col gap-2">
                      <FormLabel className="text-xs text-gray-600">
                        (Ký tên và ghi rõ họ tên)
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          disabled={isSigned}
                          placeholder="Ghi rõ họ tên"
                          className="w-full"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Partner Column - read-only */}
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium">Đối tác (Nếu có)</span>
                  <SignatureField
                    disabled
                    value={metadata.partnerSignature || ''}
                    onChange={() => {}}
                    label="Ký tên"
                    required={false}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-xs text-gray-600">
                    (Ký tên và ghi rõ họ tên)
                  </span>
                  <Input
                    value={metadata.partnerNameSignature || ''}
                    disabled
                    placeholder="Ghi rõ họ tên"
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </div>

          {!isSigned && (
            <div className="flex justify-end gap-3 pt-6 border-t border-gray-300">
              <Button
                onClick={handleOpenConfirm}
                type="button"
                disabled={isSubmitting}
                className="min-w-[120px]">
                {isSubmitting ? (
                  <Loader2Icon className="w-4 h-4 animate-spin" />
                ) : (
                  'Xác nhận ký tên'
                )}
              </Button>

              <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Xác nhận ký tên</AlertDialogTitle>
                    <AlertDialogDescription>
                      Bạn sẽ không thể chỉnh sửa chữ ký sau khi xác nhận. Vui
                      lòng kiểm tra kỹ thông tin trước khi lưu
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isSubmitting}>
                      Hủy
                    </AlertDialogCancel>
                    <AlertDialogAction
                      disabled={isSubmitting}
                      onClick={handleSubmit}>
                      {isSubmitting ? (
                        <Loader2Icon className="w-4 h-4 animate-spin" />
                      ) : (
                        'Xác nhận'
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </form>
      </Form>
    </div>
  );
};
