import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import classNames from 'classnames';
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
import type { ChecklistListing, OrderListing } from '@src/types';
import type { TOrderDetail } from '@src/types/order';

import { DatePickerField } from './DatePickerField';
import { DateTimePickerField } from './DateTimePickerField';
import { ImageUploadField } from './ImageUploadField';
import { SignatureField } from './SignatureField';

const MAX_IMAGES = 10;

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
    if (/^\d+$/.test(value)) {
      const d = new Date(Number(value));

      return isValidDate(d) ? d : undefined;
    }
    const d = new Date(value);

    return isValidDate(d) ? d : undefined;
  }

  return undefined;
};

const toDateOrNow = (value: unknown): Date =>
  toDateOrUndefined(value) ?? new Date();

const emptyToUndefined = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();

  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

const formSchema = z
  .object({
    implementationDate: z.date({
      required_error: 'Vui lòng chọn ngày triển khai',
    }),
    recordedTime: z.date({
      required_error: 'Vui lòng chọn thời gian ghi nhận',
    }),
    responsibleStaffName: z
      .string()
      .min(1, 'Vui lòng nhập tên nhân sự phụ trách'),
    clientName: z.string().min(1, 'Vui lòng nhập tên khách hàng'),
    orderCode: z.string().min(1, 'Vui lòng nhập mã đơn hàng'),
    partnerName: z.string().min(1, 'Vui lòng nhập đối tác phụ trách đơn'),
    foodTakenOutTime: z.date({
      required_error:
        'Vui lòng chọn thời gian thực phẩm đem ra khỏi nơi chế biến',
    }),
    foodSafetyTime: z.date({
      required_error: 'Vui lòng chọn thời gian an toàn của thực phẩm',
    }),
    images: z
      .array(z.any())
      .max(MAX_IMAGES, `Tối đa ${MAX_IMAGES} ảnh`)
      .min(1, 'Vui lòng chọn đăng ít nhất 1 ảnh'),
    qaQcSignature: z.string().min(1, 'Vui lòng ký tên'),
    qaQcName: z.string().min(1, 'Vui lòng ghi rõ họ tên'),
    partnerSignature: z.string().optional(),
    partnerNameSignature: z.string().optional(),
    clientSignature: z.string().optional(),
    clientNameSignature: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // Validate partner name if signature exists
    if (data.partnerSignature && data.partnerSignature.length > 0) {
      if (
        !data.partnerNameSignature ||
        data.partnerNameSignature.length === 0
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['partnerNameSignature'],
          message: 'Vui lòng ghi rõ họ tên khi đã ký tên',
        });
      }
    }

    // Validate client name if signature exists
    if (data.clientSignature && data.clientSignature.length > 0) {
      if (!data.clientNameSignature || data.clientNameSignature.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['clientNameSignature'],
          message: 'Vui lòng ghi rõ họ tên khi đã ký tên',
        });
      }
    }
  });

export type FoodHandoverChecklistFormValues = z.infer<typeof formSchema>;

type FoodHandoverChecklistFormProps = {
  subOrderDate: string;
  orderDetail: TOrderDetail;
  order: OrderListing;
  onSubmit: (values: FoodHandoverChecklistFormValues) => void | Promise<void>;
  isSubmitting?: boolean;
  isCreated?: boolean;
  checkList?: ChecklistListing;
};

const getDefaultValues = ({
  checkList,
  orderDetail,
  order,
  subOrderDate,
}: {
  checkList?: ChecklistListing;
  orderDetail: TOrderDetail;
  order: OrderListing;
  subOrderDate: string;
}): Partial<FoodHandoverChecklistFormValues> => ({
  implementationDate: checkList
    ? toDateOrNow(checkList?.attributes?.metadata?.implementationDate)
    : toDateOrNow(subOrderDate),
  recordedTime: toDateOrNow(checkList?.attributes?.metadata?.recordedTime),
  responsibleStaffName:
    checkList?.attributes?.metadata?.responsibleStaffName || '',
  clientName: order?.attributes?.metadata?.companyName || '',
  orderCode: order?.attributes?.title || '',
  partnerName: orderDetail?.[subOrderDate]?.restaurant?.restaurantName || '',
  foodTakenOutTime: toDateOrUndefined(
    checkList?.attributes?.metadata?.foodTakenOutTime,
  ),
  foodSafetyTime: toDateOrUndefined(
    checkList?.attributes?.metadata?.foodSafetyTime,
  ),
  images: checkList?.attributes?.metadata?.images || [],
  qaQcSignature: checkList?.attributes?.metadata?.qaQcSignature || '',
  qaQcName: checkList?.attributes?.metadata?.qaQcName || '',
  partnerSignature: checkList?.attributes?.metadata?.partnerSignature || '',
  partnerNameSignature:
    checkList?.attributes?.metadata?.partnerNameSignature || '',
  clientSignature: checkList?.attributes?.metadata?.clientSignature || '',
  clientNameSignature:
    checkList?.attributes?.metadata?.clientNameSignature || '',
});

export const FoodHandoverChecklistForm = ({
  subOrderDate,
  onSubmit,
  isSubmitting = false,
  checkList,
  orderDetail,
  order,
  isCreated = false,
}: FoodHandoverChecklistFormProps) => {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const form = useForm<FoodHandoverChecklistFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: getDefaultValues({
      checkList,
      orderDetail,
      order,
      subOrderDate,
    }),
  });

  useEffect(() => {
    if (checkList) {
      form.reset(
        getDefaultValues({
          checkList,
          orderDetail,
          order,
          subOrderDate,
        }),
      );
    }
  }, [checkList, form, orderDetail, order, subOrderDate]);

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit({
      ...values,
      partnerSignature: emptyToUndefined(values.partnerSignature),
      partnerNameSignature: emptyToUndefined(values.partnerNameSignature),
      clientSignature: emptyToUndefined(values.clientSignature),
      clientNameSignature: emptyToUndefined(values.clientNameSignature),
    });
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
        Food Handover To Client For
      </h2>
      <Form {...form}>
        <form onSubmit={handleSubmit} className="w-full">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-6 md:gap-4 mb-8">
            <FormField
              control={form.control}
              name="implementationDate"
              render={({ field }) => (
                <FormItem className="flex flex-col gap-2">
                  <FormLabel>
                    1. Ngày triển khai <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <DatePickerField
                      disabled
                      value={field.value}
                      onChange={(date) => field.onChange(date ?? undefined)}
                      placeholder="Chọn ngày triển khai"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="recordedTime"
              render={({ field }) => (
                <FormItem className="flex flex-col gap-2">
                  <FormLabel>
                    2. Thời gian ghi nhận{' '}
                    <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <DateTimePickerField
                      disabled={isCreated}
                      value={field.value}
                      onChange={(date) => field.onChange(date ?? undefined)}
                      placeholder="Chọn thời gian ghi nhận"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="responsibleStaffName"
              render={({ field }) => (
                <FormItem className="flex flex-col gap-2">
                  <FormLabel>
                    3. Tên nhân sự phụ trách{' '}
                    <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={isCreated}
                      placeholder="Nhập tên nhân sự phụ trách"
                      className="w-full"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="clientName"
              render={({ field }) => (
                <FormItem className="flex flex-col gap-2">
                  <FormLabel>
                    4. Tên khách hàng (công ty khách){' '}
                    <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled
                      placeholder="Nhập tên khách hàng"
                      className="w-full"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="orderCode"
              render={({ field }) => (
                <FormItem className="flex flex-col gap-2">
                  <FormLabel>
                    5. Mã đơn hàng <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled
                      placeholder="Nhập mã đơn hàng"
                      className="w-full"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="partnerName"
              render={({ field }) => (
                <FormItem className="flex flex-col gap-2">
                  <FormLabel>
                    6. Đối tác phụ trách đơn{' '}
                    <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled
                      placeholder="Nhập đối tác phụ trách đơn"
                      className="w-full"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="foodTakenOutTime"
              render={({ field }) => (
                <FormItem className="flex flex-col gap-2">
                  <FormLabel>
                    7. Thời gian thực phẩm đem ra khỏi nơi chế biến{' '}
                    <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <DateTimePickerField
                      disabled={isCreated}
                      value={field.value}
                      onChange={(date) => field.onChange(date ?? undefined)}
                      placeholder="Chọn thời gian thực phẩm đem ra"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="foodSafetyTime"
              render={({ field }) => (
                <FormItem className="flex flex-col gap-2">
                  <FormLabel>
                    8. Thời gian an toàn của thực phẩm{' '}
                    <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <DateTimePickerField
                      disabled={isCreated}
                      value={field.value}
                      onChange={(date) => field.onChange(date ?? undefined)}
                      placeholder="Chọn thời gian an toàn"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="images"
              render={({ field }) => (
                <FormItem
                  className={classNames(
                    'flex flex-col gap-2',
                    'col-span-1 md:col-span-2',
                  )}>
                  <FormLabel>
                    9. Hình ảnh thực phẩm bàn giao (tối đa {MAX_IMAGES} ảnh)
                    <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <ImageUploadField
                      disabled={isCreated}
                      value={field.value || []}
                      onChange={field.onChange}
                      maxImages={MAX_IMAGES}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Signature Section */}
          <div className="mb-8 pt-6 border-t border-gray-300">
            <h3 className="text-lg font-semibold mb-4">Phần ký tên</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* QA/QC Column */}
              <div className="flex flex-col gap-4">
                <FormField
                  control={form.control}
                  name="qaQcSignature"
                  render={({ field }) => (
                    <FormItem className="flex flex-col gap-2">
                      <FormLabel className="text-sm font-medium">
                        Nhân viên QA/QC
                      </FormLabel>
                      <FormControl>
                        <SignatureField
                          disabled={isCreated}
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
                  name="qaQcName"
                  render={({ field }) => (
                    <FormItem className="flex flex-col gap-2">
                      <FormLabel className="text-xs text-gray-600">
                        (Ký tên và ghi rõ họ tên)
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          disabled={isCreated}
                          placeholder="Ghi rõ họ tên"
                          className="w-full"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Partner Column */}
              <div className="flex flex-col gap-4">
                <FormField
                  control={form.control}
                  name="partnerSignature"
                  render={({ field }) => (
                    <FormItem className="flex flex-col gap-2">
                      <FormLabel className="text-sm font-medium">
                        Đối tác (Nếu có)
                      </FormLabel>
                      <FormControl>
                        <SignatureField
                          disabled={isCreated}
                          value={field.value || ''}
                          onChange={(signature) =>
                            field.onChange(signature ?? '')
                          }
                          label="Ký tên"
                          required={false}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="partnerNameSignature"
                  render={({ field }) => (
                    <FormItem className="flex flex-col gap-2">
                      <FormLabel className="text-xs text-gray-600">
                        (Ký tên và ghi rõ họ tên)
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          disabled={isCreated}
                          placeholder="Ghi rõ họ tên"
                          className="w-full"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Client Column */}
              <div className="flex flex-col gap-4">
                <FormField
                  control={form.control}
                  name="clientSignature"
                  render={({ field }) => (
                    <FormItem className="flex flex-col gap-2">
                      <FormLabel className="text-sm font-medium">
                        Khách hàng (Nếu có)
                      </FormLabel>
                      <FormControl>
                        <SignatureField
                          disabled={isCreated}
                          value={field.value || ''}
                          onChange={(signature) =>
                            field.onChange(signature ?? '')
                          }
                          label="Ký tên"
                          required={false}
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
                          disabled={isCreated}
                          placeholder="Ghi rõ họ tên"
                          className="w-full"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </div>

          {!isCreated && (
            <div className="flex justify-end gap-3 pt-6 border-t border-gray-300">
              <Button
                onClick={handleOpenConfirm}
                type="button"
                disabled={isSubmitting}
                className="min-w-[120px]">
                {isSubmitting ? (
                  <Loader2Icon className="w-4 h-4 animate-spin" />
                ) : (
                  'Xác nhận'
                )}
              </Button>

              <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Xác nhận lưu</AlertDialogTitle>
                    <AlertDialogDescription>
                      Bạn sẽ không thể chỉnh sửa dữ liệu sau khi xác nhận. Vui
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
