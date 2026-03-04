import React, { useMemo } from 'react';
import { PiClock, PiForkKnife, PiUser } from 'react-icons/pi';
import { useIntl } from 'react-intl';
import clsx from 'clsx';
import type { StaticImageData } from 'next/image';
import Image from 'next/image';

import image2 from '../../assets/pitoAssets/1.webp';

const Experience = () => {
  const intl = useIntl();

  const [indexActive, setIndexActive] = React.useState(1);

  const onChangeIndex = (newIndex: number) => {
    setIndexActive(newIndex);
  };

  const data = useMemo(() => {
    return [
      {
        id: 1,
        title: intl.formatMessage({
          id: 'choose-all-your-meals-for-the-week-in-one-go',
        }),
        color: '#C4ECFB',
        textColor: '#3598BF',
        icon: <PiForkKnife />,
        imgSrc:
          'https://pito-test-bucket.s3.ap-southeast-2.amazonaws.com/nhan-vien-tu-dong-chon-mon.mp4',
        type: 'video',
      },
      {
        id: 2,
        title: intl.formatMessage({
          id: 'delivered-on-time-well-presented-and-nutritionally-balanced',
        }),
        color: '#C5D475',
        textColor: '#96A546',
        icon: <PiClock />,
        imgSrc: image2,
        type: 'image',
      },
      {
        id: 3,
        title: intl.formatMessage({
          id: 'personalized-lunchbox-with-your-name-and-meal-inside',
        }),
        color: '#FBD7E7',
        textColor: '#D680A3',
        icon: <PiUser />,
        imgSrc:
          'https://pito-test-bucket.s3.ap-southeast-2.amazonaws.com/giao-va-setup-tan-noi.mp4',
        type: 'video',
      },
    ];
  }, [intl]);

  return (
    <div className="flex flex-col w-full gap-8 md:gap-20 relative md:mb-36 mb-20 max-w-[1024px] mx-auto px-5 md:px-0">
      <div className="flex flex-col items-center text-center md:gap-5 gap-2 w-full pt-0">
        <h2 className="font-semibold text-2xl md:text-[40px] font-[unbounded] md:leading-tight md:whitespace-pre-line">
          {intl.formatMessage({
            id: 'your-experience-with-pito-cloud-canteen',
          })}
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-6">
        <div className="col-span-1 md:flex items-center justify-end hidden">
          {(() => {
            const activeItem = data.find((item) => item.id === indexActive);

            if (activeItem?.type === 'video') {
              return (
                <div className="relative w-full aspect-video rounded-md overflow-hidden border border-neutral-200">
                  <video
                    src={activeItem.imgSrc as string}
                    title="Video"
                    autoPlay
                    muted
                    loop
                    controls
                    playsInline
                    className="absolute top-0 left-0 w-full h-full object-cover"
                  />
                </div>
              );
            }

            return (
              <div className="relative h-full aspect-[164/175] md:aspect-[3/2] rounded-[20px] overflow-hidden">
                <Image
                  src={activeItem?.imgSrc as StaticImageData}
                  alt="Experience Image"
                  fill
                  className="object-cover"
                />
              </div>
            );
          })()}
        </div>

        <div className="col-span-1 flex flex-col justify-between w-full gap-2 md:gap-5">
          {data.map((item) => (
            <div key={item.id} className="flex flex-col gap-5">
              <div
                onClick={() => onChangeIndex(item.id)}
                className={`flex items-center gap-3 md:gap-4 transition-all duration-200 px-3 py-4 md:p-5 border rounded-2xl md:rounded-[30px] overflow-hidden ease-linear cursor-pointer`}
                style={{
                  backgroundColor:
                    item.id === indexActive ? item.color : 'white',
                  borderColor:
                    item.id === indexActive ? item.textColor : '#D7D7D7',
                }}>
                <div
                  className={clsx(
                    'size-8 md:size-11 text-lg md:text-xl flex items-center justify-center shrink-0 rounded-full',
                  )}
                  style={{
                    backgroundColor:
                      item.id === indexActive ? 'white' : item.color,
                    color: item.textColor,
                  }}>
                  {item.icon}
                </div>

                <span className="text-base md:text-lg text-left font-medium">
                  {item.title}
                </span>
              </div>
              {item.id === indexActive && (
                <div className="block md:hidden">
                  {(() => {
                    if (item?.type === 'video') {
                      return (
                        <div className="relative w-full aspect-video rounded-md overflow-hidden border border-neutral-200">
                          <video
                            src={item.imgSrc as string}
                            autoPlay
                            muted
                            loop
                            controls
                            playsInline
                            className="absolute top-0 left-0 w-full h-full object-cover"
                          />
                        </div>
                      );
                    }

                    return (
                      <div className="relative w-full aspect-video rounded-[20px] overflow-hidden">
                        <Image
                          src={item?.imgSrc as StaticImageData}
                          alt="Experience Image"
                          fill
                          className="object-cover"
                        />
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Experience;
