import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Footer } from '../components/layout/Footer';

const initiatives = [
  {
    name: 'Estethica',
    url: 'data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTAwIDEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB4PSIxMCIgeT0iMTAiIHdpZHRoPSI4MCIgaGVpZ2h0PSIyMCIgZmlsbD0iIzEzMUMxOCIvPjxyZWN0IHg9IjEwIiB5PSI0MCIgd2lkdGg9IjgwIiBoZWlnaHQ9IjIwIiBmaWxsPSIjMTMxQzE4Ii8+PHJlY3QgeD0iMTAiIHk9IjcwIiB3aWR0aD0iODAiIGhlaWdodD0iMjAiIGZpbGw9IiMxMzFDMTgiLz48L3N2Zz4=',
    href: 'https://www.estethica.com/',
    imageClassName: 'h-10 w-10',
  },
  {
    name: 'Iro Iro',
    url: 'https://framerusercontent.com/images/I832b7iZYGhar08MeqXTnrXE0TA.png',
    href: 'https://iroirozerowaste.com',
    imageClassName: 'h-12 w-auto max-w-16',
  },
];

const supporters = [
  {
    name: 'UAL Fashion, Textiles and Technology Institute',
    url: 'https://framerusercontent.com/images/vJF1QbF0EXixrZS1fTq0YedHPWE.png',
    imageClassName: 'w-[88px] max-w-full lg:w-[122px] lg:max-w-none',
  },
  {
    name: 'British Council',
    url: 'https://framerusercontent.com/images/7pyvLdQzMPkyxitxCpPjxuMFO9Q.png',
    imageClassName: 'w-[104px] max-w-full lg:w-36 lg:max-w-none',
  },
];

const howItWorks = [
  {
    title: 'Explore the map',
    description: 'Find menders near you, searchable by skill and location.',
  },
  {
    title: 'Connect',
    description: 'Reach out directly to book a repair or ask a question.',
  },
  {
    title: 'Add a mender',
    description: "Know a mending practitioner, or are one yourself? Tap 'Add a Mender' and share their details.",
  },
];

const logoClassName =
  'object-contain mix-blend-multiply grayscale opacity-60 transition-[filter,opacity] duration-300 hover:grayscale-0 hover:opacity-100';

export function AboutPage({ homepage = false }: { homepage?: boolean }) {
  const heroRef = useRef<HTMLElement>(null);
  const [heroTextOpacity, setHeroTextOpacity] = useState(1);
  const { hash } = useLocation();
  const heroImage = homepage
    ? {
        src: '/images/about/red-patched-top.webp',
        alt: 'A red ribbed top repaired with colorful visible mending patches',
        width: 1086,
        height: 1448,
      }
    : {
        src: '/images/about/visible-mending-sweater.jpg',
        alt: 'A charcoal knitted sweater restored with visible woven patches',
        width: 726,
        height: 1024,
      };

  useEffect(() => {
    if (hash !== '#about-mission') return;

    const frame = window.requestAnimationFrame(() => {
      document.getElementById('about-mission')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [hash]);

  useEffect(() => {
    const updateHeroTextOpacity = () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setHeroTextOpacity(1);
        return;
      }

      const heroHeight = heroRef.current?.getBoundingClientRect().height ?? window.innerHeight;
      const progress = Math.min(Math.max(window.scrollY / Math.max(heroHeight, 1), 0), 1);
      setHeroTextOpacity(1 - progress * 0.85);
    };

    let frame: number | null = null;
    const handleScroll = () => {
      if (frame !== null) return;

      frame = window.requestAnimationFrame(() => {
        frame = null;
        updateHeroTextOpacity();
      });
    };

    updateHeroTextOpacity();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#f3f5f9] pt-20 text-[var(--mm-text)]">
      <main>
        <section
          ref={heroRef}
          aria-labelledby="about-hero-title"
          className="grid w-full bg-brand-dark/95 lg:h-[calc(100svh-5rem)] lg:grid-cols-[2fr_1fr] lg:gap-x-12"
        >
          <div className="flex min-h-[28rem] items-end px-[30px] pb-12 pt-20 sm:min-h-[34rem] sm:pb-16 lg:min-h-0 lg:pb-16 lg:pt-0">
            <h1
              id="about-hero-title"
              className="font-display text-[clamp(24px,7.6vw,42px)] leading-[0.98] text-[var(--mm-text)] sm:text-[56px] lg:text-[clamp(48px,4.45vw,76px)]"
              style={{ opacity: heroTextOpacity }}
            >
              <span className="block">The only antidote</span>
              <span className="block whitespace-nowrap">to a throwaway society</span>
              <span className="block">is to keep</span>
            </h1>
          </div>

          <figure className="w-full overflow-hidden">
            <img
              src={heroImage.src}
              alt={heroImage.alt}
              className="block h-auto w-full lg:h-full lg:object-cover lg:object-center"
              width={heroImage.width}
              height={heroImage.height}
              decoding="async"
            />
          </figure>
        </section>

        <section
          id="about-mission"
          aria-labelledby="about-mission-title"
          className="scroll-mt-20 px-[30px] pb-12 pt-24 text-center sm:pb-16 sm:pt-32 lg:pb-20 lg:pt-40"
        >
          <div className="mx-auto max-w-3xl">
            <h2
              id="about-mission-title"
              className="font-display text-[19.33px] uppercase text-[var(--mm-faint)]"
            >
              Our Mission
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-[1.55] text-[var(--mm-text-soft)] sm:text-[20px]">
              My Mender is a map-based digital platform designed to extend the life of garments by reconnecting people with their local menders, making repair services visible, searchable and trustworthy, while documenting the cultural knowledge and everyday practices that already exist but remain undervalued and undocumented.
            </p>
          </div>
        </section>

        <section
          aria-labelledby="how-it-works-title"
          className="px-[30px] pb-24 pt-12 text-center sm:pb-32 sm:pt-16 lg:pb-40 lg:pt-20"
        >
          <div className="mx-auto max-w-6xl">
            <h2
              id="how-it-works-title"
              className="font-display text-[19.33px] uppercase text-[var(--mm-faint)]"
            >
              How It Works
            </h2>

            <div className="mx-auto mt-20 grid max-w-5xl divide-y divide-black/[0.1] text-left sm:mt-24 lg:grid-cols-3 lg:divide-y-0">
              {howItWorks.map((step) => (
                <article key={step.title} className="py-7 lg:px-8 lg:py-2">
                  <h3 className="text-center text-[18px] leading-[1.2] text-[var(--mm-text)]">{step.title}</h3>
                  <p className="mt-3 max-w-2xl text-center text-[15px] leading-[1.55] text-[var(--mm-text-soft)]">
                    {step.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section aria-label="Organizations">
          <div className="grid gap-y-9 px-[30px] py-10 sm:py-12 lg:grid-cols-2 lg:items-center lg:gap-x-0">
            <div className="grid grid-cols-[5.75rem_minmax(0,1fr)] items-center gap-x-4 lg:flex lg:justify-center lg:gap-x-0">
              <h2 className="mymenders-field-label-font text-[10px] uppercase text-[var(--mm-faint)] lg:mr-[50px] lg:shrink-0">
                Initiative Of
              </h2>
              <div className="grid min-w-0 grid-cols-2 items-center gap-x-5 lg:flex lg:justify-start lg:gap-[50px]">
                {initiatives.map((initiative) => (
                  <a
                    key={initiative.name}
                    href={initiative.href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={initiative.name}
                    className="group flex min-w-0 items-center justify-center lg:shrink-0"
                  >
                    <img
                      src={initiative.url}
                      alt=""
                      className={`${logoClassName} ${initiative.imageClassName} group-hover:grayscale-0 group-hover:opacity-100`}
                    />
                  </a>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-[5.75rem_minmax(0,1fr)] items-center gap-x-4 lg:flex lg:justify-center lg:gap-x-0">
              <h2 className="mymenders-field-label-font text-[10px] uppercase text-[var(--mm-faint)] lg:mr-[50px] lg:shrink-0">
                Supported By
              </h2>
              <div className="grid min-w-0 grid-cols-2 items-center gap-x-5 lg:flex lg:justify-start lg:gap-[50px]">
                {supporters.map((supporter) => (
                  <div key={supporter.name} className="flex min-w-0 items-center justify-center lg:shrink-0">
                    <img
                      src={supporter.url}
                      alt={supporter.name}
                      className={`${logoClassName} ${supporter.imageClassName}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
