import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Instagram } from 'lucide-react';
import { Button } from '../ui/button';
import { ButtonGroup } from '../ui/button-group';
import { InputGroup, InputGroupInput } from '../ui/input-group';

export function Footer() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubscribe = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const targetEmail = email.trim();
    if (!targetEmail || status === 'submitting') return;

    setStatus('submitting');
    setMessage('');

    try {
      const res = await fetch(`${window.location.origin}/api/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail }),
      });

      if (res.ok) {
        setEmail('');
        setStatus('success');
        setMessage("You're on the list — see you in the inbox!");
      } else {
        const data = await res.json().catch(() => null);
        setStatus('error');
        setMessage(data?.error || 'Something went wrong. Please try again.');
      }
    } catch {
      setStatus('error');
      setMessage('Something went wrong. Please try again.');
    }
  };

  return (
    <footer className="bg-brand-dark text-[var(--mm-text)]">
      <div className="flex min-h-[100px] flex-col items-center justify-center gap-5 bg-[var(--color-brand)] px-[30px] py-6 sm:flex-row sm:gap-6 sm:py-0">
        <div className="flex flex-col gap-1 text-center">
          <p className="text-[18px] leading-[23px] text-[var(--mm-text)]">Join our Instagram community</p>
          <p className="text-sm leading-5 text-[var(--mm-text-soft)]">
            Follow the people and practices keeping clothes alive.
          </p>
        </div>
        <a
          href="https://www.instagram.com/my.mender"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Follow My Mender on Instagram"
          className="flex shrink-0 items-center gap-3 rounded-full border border-[rgba(23,27,23,0.55)] px-4 py-[11px] text-sm leading-[18px] text-[var(--mm-text)] transition-colors hover:bg-white/20"
        >
          <Instagram aria-hidden="true" className="h-[17px] w-[17px] stroke-[1.7]" />
          <span>Follow @my.mender</span>
        </a>
      </div>

      <div className="px-[30px] py-14 md:py-16">
        <div className="flex flex-col justify-between gap-12 lg:flex-row lg:items-start">
          <div className="max-w-xs">
            <div className="footer-engraved-logo" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <p className="mt-5 text-sm leading-relaxed text-[var(--mm-muted)]">
              My mender is an initiative of Bhaavya Goenka and Orsola de Castro
            </p>
          </div>

          <div className="grid flex-1 gap-10 sm:grid-cols-2 lg:grid-cols-[minmax(0,9rem)_minmax(0,9rem)_minmax(0,9rem)_1fr] lg:gap-12">
            <div>
              <p className="mymenders-section-label text-[var(--mm-text)]">Company</p>
              <nav className="mt-4 flex flex-col gap-2.5 text-sm">
                <Link to="/map" className="text-[var(--mm-muted)] transition-colors hover:text-[var(--mm-text)]">
                  Map
                </Link>
                <Link to="/about" className="text-[var(--mm-muted)] transition-colors hover:text-[var(--mm-text)]">
                  About Us
                </Link>
                <Link to="/add" className="text-[var(--mm-muted)] transition-colors hover:text-[var(--mm-text)]">
                  Add a Mender
                </Link>
              </nav>
            </div>

            <div>
              <p className="mymenders-section-label text-[var(--mm-text)]">Legal</p>
              <nav className="mt-4 flex flex-col gap-2.5 text-sm">
                <Link to="/privacy" className="text-[var(--mm-muted)] transition-colors hover:text-[var(--mm-text)]">
                  Your Privacy
                </Link>
                <Link to="/terms" className="text-[var(--mm-muted)] transition-colors hover:text-[var(--mm-text)]">
                  Terms and Conditions
                </Link>
              </nav>
            </div>

            <div>
              <p className="mymenders-section-label text-[var(--mm-text)]">Social</p>
              <nav className="mt-4 flex flex-col gap-2.5 text-sm">
                <a
                  href="https://www.instagram.com/my.mender"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--mm-muted)] transition-colors hover:text-[var(--mm-text)]"
                >
                  Instagram
                </a>
                <a
                  href="https://www.linkedin.com/company/my-mender/home/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--mm-muted)] transition-colors hover:text-[var(--mm-text)]"
                >
                  LinkedIn
                </a>
              </nav>
            </div>

            <div className="w-full sm:col-span-2 lg:col-span-1 lg:w-[24rem] lg:max-w-full lg:justify-self-end">
              <p className="mymenders-section-label text-[var(--mm-text)]">Stay in touch</p>
              <form onSubmit={handleSubscribe} className="mt-4">
                <ButtonGroup className="w-full">
                  <InputGroup className="h-11 min-w-0 flex-1 rounded-l-full border-[0.5px] border-black bg-white shadow-none focus-within:border-black focus-within:ring-[3px] focus-within:ring-[var(--mm-focus)]">
                    <InputGroupInput
                      type="email"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      aria-label="Email address"
                      placeholder="Enter your email"
                      className="h-9 px-3 text-sm placeholder:text-[var(--mm-faint)] focus-visible:ring-0"
                    />
                  </InputGroup>
                  <Button
                    type="submit"
                    disabled={status === 'submitting'}
                    size="lg"
                    className="h-11 rounded-r-full border-[0.5px] border-black bg-[var(--color-brand)] px-4 text-sm text-brand-dark-on hover:bg-[var(--color-brand-hover)]"
                  >
                    {status === 'submitting' ? 'Subscribing…' : 'Subscribe'}
                  </Button>
                </ButtonGroup>
              </form>
              {message ? (
                <p
                  role="status"
                  className={`mt-2.5 text-xs ${status === 'error' ? 'text-[#c46a3d]' : 'text-[#567a58]'}`}
                >
                  {message}
                </p>
              ) : null}
            </div>
          </div>
        </div>

      </div>
    </footer>
  );
}
