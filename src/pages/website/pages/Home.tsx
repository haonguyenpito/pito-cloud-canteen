import footerCarousel1 from '../assets/footer-carousel/com-trua-van-phong-pito-cloud-canteen-1.webp';
import footerCarousel2 from '../assets/footer-carousel/com-trua-van-phong-pito-cloud-canteen-2.webp';
import footerCarousel3 from '../assets/footer-carousel/com-trua-van-phong-pito-cloud-canteen-3.webp';
import footerCarousel4 from '../assets/footer-carousel/com-trua-van-phong-pito-cloud-canteen-4.webp';
import footerCarousel5 from '../assets/footer-carousel/com-trua-van-phong-pito-cloud-canteen-5.webp';
import footerCarousel6 from '../assets/footer-carousel/com-trua-van-phong-pito-cloud-canteen-6.webp';
import footerCarousel7 from '../assets/footer-carousel/com-trua-van-phong-pito-cloud-canteen-7.webp';
import footerCarousel8 from '../assets/footer-carousel/com-trua-van-phong-pito-cloud-canteen-8.webp';
import footerCarousel9 from '../assets/footer-carousel/com-trua-van-phong-pito-cloud-canteen-9.webp';
import footerCarousel10 from '../assets/footer-carousel/com-trua-van-phong-pito-cloud-canteen-10.webp';
import footerCarousel11 from '../assets/footer-carousel/com-trua-van-phong-pito-cloud-canteen-11.webp';
import footerCarousel12 from '../assets/footer-carousel/com-trua-van-phong-pito-cloud-canteen-12.webp';
import footerCarousel13 from '../assets/footer-carousel/com-trua-van-phong-pito-cloud-canteen-13.webp';
import footerCarousel14 from '../assets/footer-carousel/com-trua-van-phong-pito-cloud-canteen-14.webp';
import footerCarousel15 from '../assets/footer-carousel/com-trua-van-phong-pito-cloud-canteen-15.webp';
import footerCarousel16 from '../assets/footer-carousel/com-trua-van-phong-pito-cloud-canteen-16.webp';
import CTA from '../components/CTA';
import FAQs from '../components/FAQs';
import Features from '../components/Features';
import Hero from '../components/Home/Hero';
import ServicesImages from '../components/ServicesImages';
import Solutions from '../components/Solutions';
import Testimonials from '../components/Testimonials';
import TrustedCompanies from '../components/TrustedCompanies/index';

import 'lenis/dist/lenis.css';

const images = [
  footerCarousel1,
  footerCarousel2,
  footerCarousel3,
  footerCarousel4,
  footerCarousel5,
  footerCarousel6,
  footerCarousel7,
  footerCarousel8,
  footerCarousel9,
  footerCarousel10,
  footerCarousel11,
  footerCarousel12,
  footerCarousel13,
  footerCarousel14,
  footerCarousel15,
  footerCarousel16,
];

const Home = () => {
  return (
    <div>
      <Hero />
      <TrustedCompanies />
      <Features />
      <Testimonials />
      <Solutions />
      <FAQs />
      <CTA />
      <ServicesImages
        images={images}
        alt="com-trua-van-phong-pito-cloud-canteen"
      />
    </div>
  );
};

export default Home;
