import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Menu, Plus, X } from 'lucide-react';
import { BrandLogo } from '../BrandLogo';

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const isAbout = pathname === '/' || pathname === '/about';

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        menuTriggerRef.current?.focus();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusableElements = drawerRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])',
      );
      if (!focusableElements?.length) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const closeMenu = () => {
    setIsOpen(false);
    menuTriggerRef.current?.focus();
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-[1000] bg-brand-dark/95 text-[var(--mm-text)] ${isOpen ? '' : 'backdrop-blur-sm'}`}
    >
      <div className="px-[30px]">
        <div className="flex justify-between h-20">
          <div className="flex items-center">
            <NavLink to="/" className="flex items-center gap-3">
              <BrandLogo className="h-6 w-6 shrink-0 md:h-[29px] md:w-[29px]" color="var(--color-brand-dark-text)" />
              <span className="mymenders-logo-wordmark text-2xl mymenders-logo-font text-brand-dark-text md:text-[29px]">
                My Mender
              </span>
            </NavLink>
          </div>

          <div className="hidden md:flex h-20 items-stretch gap-2">
            <NavLink
              to="/#about-mission"
              className="group relative inline-flex items-center justify-center px-3 text-sm "
            >
              {({ isActive }) => (
                <span className={`border-b-2 pb-0.5 transition-colors group-hover:border-[#d9dfdb] ${isActive || isAbout ? 'border-[#d9dfdb]' : 'border-transparent'}`}>
                  About
                </span>
              )}
            </NavLink>
            <NavLink
              to="/map"
              className="group relative inline-flex items-center justify-center px-3 text-sm "
            >
              {({ isActive }) => (
                <span className={`border-b-2 pb-0.5 transition-colors group-hover:border-[#d9dfdb] ${isActive ? 'border-[#d9dfdb]' : 'border-transparent'}`}>
                  Map
                </span>
              )}
            </NavLink>
            <a
              href="https://www.instagram.com/my.mender"
              target="_blank"
              rel="noopener noreferrer"
              className="group relative inline-flex items-center justify-center px-3 text-sm"
            >
              <span className="border-b-2 border-transparent pb-0.5 transition-colors group-hover:border-[#d9dfdb]">
                Instagram
              </span>
            </a>
            <div className="flex items-center pl-3">
              <button
                onClick={() => navigate('/add')}
                className="flex h-11 cursor-pointer items-center justify-center rounded-full bg-white px-4 text-brand-dark-on shadow-[var(--mm-shadow-subtle)] transition-colors hover:bg-[#d9dfdb]"
                title="Add Mender"
                aria-label="Add mender"
              >
                <Plus className="h-5 w-5 shrink-0" />
                <span className="ml-2 text-sm">Add Mender</span>
              </button>
            </div>
          </div>

          <div className="flex md:hidden items-center">
            <button
              ref={menuTriggerRef}
              onClick={() => setIsOpen(!isOpen)}
              className="rounded-full p-2 opacity-80 transition-colors hover:bg-black/5 hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mm-text)]"
              aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={isOpen}
              aria-controls="mobile-navigation-menu"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      <div
        id="mobile-navigation-menu"
        ref={drawerRef}
        hidden={!isOpen}
        role="dialog"
        aria-modal="true"
        aria-label="Primary navigation"
        className="fixed inset-0 z-[1001] h-[100dvh] w-full overflow-y-auto overscroll-contain bg-brand-dark text-[var(--mm-text)] md:hidden"
      >
        <div className="flex min-h-full flex-col">
          <div className="flex h-20 shrink-0 items-center justify-between px-[30px]">
            <NavLink to="/" onClick={closeMenu} className="flex items-center gap-3">
              <BrandLogo className="h-6 w-6 shrink-0" color="var(--color-brand-dark-text)" />
              <span className="mymenders-logo-wordmark text-2xl mymenders-logo-font text-brand-dark-text">
                My Mender
              </span>
            </NavLink>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={closeMenu}
              aria-label="Close navigation menu"
              className="flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mm-text)]"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="flex flex-1 items-center px-6 py-8">
            <div className="mx-auto w-full max-w-sm space-y-1">
              <NavLink
                to="/#about-mission"
                onClick={closeMenu}
                className="group flex min-h-16 items-center justify-center text-center text-[clamp(1.625rem,7vw,1.875rem)] hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--mm-text)]"
              >
                {({ isActive }) => (
                  <span className={`border-b-2 pb-0.5 transition-colors group-hover:border-[#d9dfdb] ${isActive || isAbout ? 'border-[#d9dfdb]' : 'border-transparent'}`}>About</span>
                )}
              </NavLink>
              <NavLink
                to="/map"
                onClick={closeMenu}
                className="group flex min-h-16 items-center justify-center text-center text-[clamp(1.625rem,7vw,1.875rem)] hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--mm-text)]"
              >
                {({ isActive }) => (
                  <span className={`border-b-2 pb-0.5 transition-colors group-hover:border-[#d9dfdb] ${isActive ? 'border-[#d9dfdb]' : 'border-transparent'}`}>Map</span>
                )}
              </NavLink>
              <a
                href="https://www.instagram.com/my.mender"
                target="_blank"
                rel="noopener noreferrer"
                onClick={closeMenu}
                className="group flex min-h-16 items-center justify-center text-center text-[clamp(1.625rem,7vw,1.875rem)] hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--mm-text)]"
              >
                <span className="border-b-2 border-transparent pb-0.5 transition-colors group-hover:border-[#d9dfdb]">
                  Instagram
                </span>
              </a>
              <button
                type="button"
                onClick={() => {
                  closeMenu();
                  navigate('/add');
                }}
                className="mx-auto mt-7 flex min-h-12 w-fit cursor-pointer items-center gap-2 rounded-full bg-[#171b17] px-6 text-base text-white transition-colors hover:bg-[#343a35] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mm-text)]"
              >
                <Plus className="h-4 w-4 shrink-0" />
                Add Mender
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
