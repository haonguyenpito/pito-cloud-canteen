import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useIntl } from 'react-intl';
import classNames from 'classnames';

import Modal from '@components/Modal/Modal';
import { useAppDispatch } from '@hooks/reduxHooks';
import {
  removeImage,
  uploadImageThunks,
} from '@redux/slices/uploadImage.slice';

type ImageItem = {
  id: string;
  imageUrl?: string;
  imageId?: string;
  file?: File;
  state: 'uploading' | 'uploaded' | 'error';
};

type ImageUploadFieldProps = {
  value: ImageItem[];
  onChange: (images: ImageItem[]) => void;
  maxImages?: number;
  disabled?: boolean;
};

export const ImageUploadField = ({
  value = [],
  onChange,
  maxImages = 10,
  disabled = false,
}: ImageUploadFieldProps) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const [localImages, setLocalImages] = useState<ImageItem[]>(value);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const handleImagesChange = useCallback(
    (newImages: ImageItem[]) => {
      setLocalImages(newImages);
      onChange(newImages);
    },
    [onChange],
  );

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (disabled) return;

      const currentCount = localImages.length;
      const remainingSlots = maxImages - currentCount;
      const filesToAdd = acceptedFiles.slice(0, remainingSlots);

      if (filesToAdd.length === 0) {
        return;
      }

      const newImageItems: ImageItem[] = filesToAdd.map((file) => ({
        id: `${file.name}_${Date.now()}_${Math.random()}`,
        file,
        imageUrl: URL.createObjectURL(file),
        state: 'uploading' as const,
      }));

      const updatedImages = [...localImages, ...newImageItems];
      handleImagesChange(updatedImages);

      // Upload images
      const uploadParams = newImageItems.map((item) => ({
        id: item.id,
        file: item.file!,
      }));

      try {
        const result = await dispatch(
          uploadImageThunks.uploadImages(uploadParams),
        );
        const uploadedResults = result.payload as any[];

        const finalImages = updatedImages.map((img) => {
          const uploadResult = uploadedResults.find((r) => r.id === img.id);
          if (uploadResult && uploadResult.uploadedImage) {
            const uploadedImage = uploadResult.uploadedImage;
            // Handle different response structures
            const imageUrl =
              uploadedImage.attributes?.variants?.['scaled-large']?.url ||
              uploadedImage.attributes?.url ||
              img.imageUrl;

            return {
              ...img,
              imageId: uploadResult.imageId || uploadedImage.id?.uuid,
              imageUrl,
              state: 'uploaded' as const,
            };
          }
          if (uploadResult && uploadResult.uploadError) {
            return {
              ...img,
              state: 'error' as const,
            };
          }

          return img;
        });

        handleImagesChange(finalImages);
      } catch (error) {
        console.error('Error uploading images:', error);
        const errorImages = updatedImages.map((img) =>
          newImageItems.find((ni) => ni.id === img.id)
            ? { ...img, state: 'error' as const }
            : img,
        );
        handleImagesChange(errorImages);
      }
    },
    [localImages, maxImages, disabled, dispatch, handleImagesChange],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif'],
    },
    disabled: disabled || localImages.length >= maxImages,
    multiple: true,
  });

  const handleRemoveImage = useCallback(
    (imageId: string) => {
      const updatedImages = localImages.filter((img) => img.id !== imageId);
      handleImagesChange(updatedImages);
      dispatch(removeImage(imageId));
    },
    [localImages, handleImagesChange, dispatch],
  );

  const canUploadMore = localImages.length < maxImages && !disabled;

  return (
    <div className="w-full">
      {!disabled && (
        <div
          {...getRootProps()}
          className={classNames(
            'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all bg-gray-50',
            {
              'border-gray-400 bg-gray-100': isDragActive && canUploadMore,
              'border-primary bg-primary/10': isDragActive && canUploadMore,
              'cursor-not-allowed opacity-60': !canUploadMore,
              'hover:border-gray-400 hover:bg-gray-100':
                canUploadMore && !isDragActive,
            },
          )}>
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-2">
            <svg
              className="w-12 h-12 text-gray-500 mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="text-base font-medium text-gray-700 m-0">
              {canUploadMore
                ? 'Kéo thả ảnh vào đây hoặc click để chọn'
                : `Đã đạt tối đa ${maxImages} ảnh`}
            </p>
            <p className="text-sm text-gray-500 m-0">
              {canUploadMore &&
                `Có thể upload tối đa ${maxImages} ảnh (${localImages.length}/${maxImages})`}
            </p>
          </div>
        </div>
      )}

      {localImages.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4 mt-6">
          {localImages.map((image, index) => (
            <div
              key={image.id || `image-${index}`}
              className="relative aspect-square">
              <div
                className={classNames(
                  'relative w-full h-full rounded-lg overflow-hidden border border-gray-300',
                  {
                    'cursor-pointer hover:border-primary transition-colors':
                      disabled && image.imageUrl,
                  },
                )}
                onClick={() => {
                  if (disabled && image.imageUrl) {
                    setPreviewImage(image.imageUrl);
                  }
                }}>
                {image.state === 'uploading' && (
                  <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white text-sm font-medium">
                    <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin mb-2" />
                    <span>Đang tải lên...</span>
                  </div>
                )}
                {image.state === 'error' && (
                  <div className="absolute inset-0 bg-red-500/80 flex flex-col items-center justify-center text-white text-sm font-medium">
                    <span>Lỗi tải lên</span>
                  </div>
                )}
                {image.imageUrl && (
                  <img
                    src={image.imageUrl}
                    alt="Food handover"
                    className="w-full h-full object-cover"
                  />
                )}
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveImage(image.id);
                    }}
                    className={classNames(
                      'absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white border-none cursor-pointer flex items-center justify-center text-xl leading-none transition-all',
                      {
                        'hover:bg-black/80 hover:scale-110':
                          image.state !== 'uploading',
                        'cursor-not-allowed opacity-50':
                          image.state === 'uploading',
                      },
                    )}
                    disabled={image.state === 'uploading'}>
                    ×
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={!!previewImage}
        handleClose={() => setPreviewImage(null)}
        title={intl.formatMessage({ id: 'ReviewCard.imagePreviewTitle' })}
        shouldFullScreenInMobile
        shouldHideGreyBackground={false}>
        <div className="p-2 flex items-center justify-center">
          {previewImage && (
            <img
              src={previewImage}
              alt="Preview"
              className="max-h-[80vh] w-auto max-w-full object-contain"
            />
          )}
        </div>
      </Modal>
    </div>
  );
};
