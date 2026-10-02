import React from 'react';
import clsx from 'clsx';
import type { StaticImageData } from 'next/image';
import Image from 'next/image';

import css from './styles.module.css';

const ServiceImages = ({
  images,
  alt,
}: {
  images: StaticImageData[];
  alt?: string;
}) => {
  // Keeps scroll speed constant regardless of image count (6 images = 240s).
  const animationDuration = `${images.length * 40}s`;

  return (
    <div className="mx-auto">
      <div className={clsx(css.carousel__services_feature)}>
        <div
          className={clsx('py-4', css.services_feature)}
          style={{ animationDuration }}>
          {images.concat(images).map((image, index) => (
            <div key={index} className={css.services__item_feature}>
              <div className="flex flex-col items-start relative size-full cursor-pointer gap-1 overflow-hidden rounded-xl border border-solid border-neutral-100">
                <div className="relative size-full">
                  <Image
                    src={image}
                    alt={
                      alt
                        ? `${alt}-${(index % images.length) + 1}`
                        : `Service Image ${index + 1}`
                    }
                    fill
                    className="object-cover"
                    quality={100}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div
          className={clsx('py-4', css.services_feature)}
          style={{ animationDuration }}>
          {images.concat(images).map((image, index) => (
            <div key={index} className={css.services__item_feature}>
              <div className="flex flex-col items-start relative size-full cursor-pointer gap-1 overflow-hidden rounded-xl border border-solid border-neutral-100">
                <div className="relative size-full">
                  <Image
                    src={image}
                    alt={
                      alt
                        ? `${alt}-${(index % images.length) + 1}`
                        : `Service Image ${index + 1}`
                    }
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 80vw, (max-width: 1200px) 33vw, 15vw"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ServiceImages;
