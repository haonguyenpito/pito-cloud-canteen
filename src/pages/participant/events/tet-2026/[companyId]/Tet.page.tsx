import React from 'react';
import { ArrowLeftIcon } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import Button from '@components/Button/Button';

import logo from '../../../../website/assets/Logo.svg';

const TetPage = ({ companyId }: { companyId: string }) => {
  return (
    <div className="min-h-screen bg-white font-sans py-10 px-6 md:px-12 relative overflow-hidden">
      <div className="relative w-full max-w-3xl mx-auto z-10">
        {/* Header with Logo */}
        <Link className="md:hidden mb-5" href="/participant/orders">
          <Button
            type="button"
            size="small"
            variant="inline"
            className="flex border-none p-0">
            <ArrowLeftIcon className="w-4 h-4" />
          </Button>
        </Link>
        <div className="relative mt-2 md:hidden w-16 aspect-[1415/929]">
          <Image
            src={logo}
            alt="logo"
            fill
            priority
            loading="eager"
            quality={100}
          />
        </div>
        {/* Hero Video */}
        <div className="mb-8 mt-4 flex justify-center">
          <div className="relative md:w-[400px] w-full rounded-2xl border border-[#17176026] bg-gradient-to-r from-[#e0f3ff] via-white to-[#ffe2f1] p-[1px] shadow-lg shadow-[#1717601a]">
            <div className="relative overflow-hidden rounded-[18px] bg-black/70">
              <video
                src={`https://api-prod.pito.vn/storage/v1/object/public/videos/customer-site/pcc-${companyId}.mp4`}
                autoPlay
                muted
                loop
                playsInline
                className="block w-full object-cover"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-black/40 via-transparent to-black/10" />
              <div className="pointer-events-none absolute bottom-4 left-0 right-0 px-6 text-white">
                <p className="text-xs tracking-[0.3em] uppercase text-white/70">
                  PITO Cloud Canteen
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TetPage;
