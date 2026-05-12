'use client';

/**
 * Small shared building blocks for the Planer flow.
 * Kept in one file so the import graph stays flat.
 *
 * fn-15.5: motion / useMotionValue / useSpring / HTMLMotionProps were
 * removed. The PlanerButton's whileTap-scale becomes a CSS `:active`
 * scale, and the TiltingMap's spring-tracked rotation switches to
 * raw transform writes driven by the existing mouse-move handler.
 * The drop in motion quality is barely perceptible at the rotateY ≤8°
 * range we use here, and saves the entire motion-lib runtime on the
 * Planer-only bundle.
 */
import type {
  ButtonHTMLAttributes,
  ReactNode,
  MouseEvent,
  InputHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { useRef } from 'react';

// ───────────────────────────────────────────────────────────────
// PlanerShell — the atmospheric wrapper (grain + spotlight + scope)
// ───────────────────────────────────────────────────────────────

interface PlanerShellProps {
  children: ReactNode;
  /** Adds the warm radial spotlight at the top — use for hero sections */
  spotlight?: boolean;
  /** Adds the grain overlay — use for large flat areas */
  grain?: boolean;
  className?: string;
}

export function PlanerShell({ children, spotlight = true, grain = true, className = '' }: PlanerShellProps) {
  return (
    <div
      className={[
        'planer-scope min-h-screen relative',
        spotlight ? 'planer-spotlight' : '',
        grain ? 'planer-grain' : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
// Editorial display heading — large Fraunces, optional italic span
// ───────────────────────────────────────────────────────────────

interface EditorialHeadingProps {
  children: ReactNode;
  size?: 'hero' | 'section' | 'inline';
  className?: string;
}

export function EditorialHeading({ children, size = 'hero', className = '' }: EditorialHeadingProps) {
  const sizes = {
    hero: 'text-[40px] sm:text-[52px] leading-[0.95]',
    section: 'text-[28px] sm:text-[34px] leading-[1.05]',
    inline: 'text-[22px] leading-[1.2]',
  } as const;
  return (
    <h1 className={`serif-display font-light tracking-tight text-[color:var(--color-planer-ink)] ${sizes[size]} ${className}`}>
      {children}
    </h1>
  );
}

// ───────────────────────────────────────────────────────────────
// Small editorial caption — used like film-credits metadata
// "03 · kommende treffen" etc.
// ───────────────────────────────────────────────────────────────

interface CaptionProps {
  children: ReactNode;
  className?: string;
}

export function EditorialCaption({ children, className = '' }: CaptionProps) {
  return (
    <p className={`text-[10px] sm:text-[11px] uppercase text-[color:var(--color-planer-dim)] tracking-[0.22em] ${className}`}>
      {children}
    </p>
  );
}

// ───────────────────────────────────────────────────────────────
// PlanerButton — magnetic CTA with plum glow. Mouse-follow gradient
// enabled via CSS vars + a tiny motion hook.
// ───────────────────────────────────────────────────────────────

interface PlanerButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'outline';
  size?: 'md' | 'lg';
  loading?: boolean;
  children: ReactNode;
}

export function PlanerButton({
  variant = 'primary',
  size = 'md',
  loading = false,
  children,
  className = '',
  onMouseMove,
  disabled,
  ...rest
}: PlanerButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);

  const handleMouseMove = (e: MouseEvent<HTMLButtonElement>) => {
    const el = ref.current;
    if (el) {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    }
    onMouseMove?.(e);
  };

  // fn-15.5: framer whileTap={scale:0.97} replaced with the global
  // `:active { transform: scale(0.97) }` rule in globals.css that
  // already applies to every button. No extra class needed.
  const base = 'magnetic-cta relative inline-flex items-center justify-center gap-2 font-medium rounded-full transition-colors whitespace-nowrap disabled:opacity-50 disabled:pointer-events-none';
  const sizes = {
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-7 py-3.5 text-[15px]',
  }[size];
  const variants = {
    primary: 'bg-[color:var(--color-planer-accent)] text-[color:var(--color-planer-void)] hover:bg-[#ffffff]',
    outline: 'border border-[color:var(--color-planer-accent)]/40 text-[color:var(--color-planer-accent)] hover:border-[color:var(--color-planer-accent)]/70 hover:bg-[color:var(--color-planer-accent)]/5',
    ghost: 'text-[color:var(--color-planer-dim)] hover:text-[color:var(--color-planer-ink)] hover:bg-white/[0.03]',
  }[variant];

  return (
    <button
      ref={ref}
      className={`${base} ${sizes} ${variants} ${className}`}
      onMouseMove={handleMouseMove}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <span className="inline-block w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin motion-reduce:animate-none" />
      ) : (
        <span className="relative z-10 flex items-center gap-2">{children}</span>
      )}
    </button>
  );
}

// ───────────────────────────────────────────────────────────────
// FormField — consistent label + input + hint wrapper
// ───────────────────────────────────────────────────────────────

interface FormFieldProps {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function FormField({ label, hint, required, children, className = '' }: FormFieldProps) {
  return (
    <label className={`block ${className}`}>
      <span className="flex items-baseline gap-2 mb-2">
        <span className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-planer-dim)] font-medium">
          {label}
        </span>
        {required && <span className="text-[color:var(--color-planer-accent)] text-[10px]">•</span>}
        {hint && <span className="text-[10px] text-[color:var(--color-planer-whisper)] italic">— {hint}</span>}
      </span>
      {children}
    </label>
  );
}

// ───────────────────────────────────────────────────────────────
// PlanerInput — styled text input
// ───────────────────────────────────────────────────────────────

interface PlanerInputProps extends InputHTMLAttributes<HTMLInputElement> {
  iconLeft?: ReactNode;
}

export function PlanerInput({ iconLeft, className = '', ...rest }: PlanerInputProps) {
  return (
    <div className="relative">
      {iconLeft && (
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--color-planer-whisper)]">
          {iconLeft}
        </span>
      )}
      <input
        {...rest}
        className={[
          'w-full rounded-xl border bg-transparent px-4 py-3 text-[15px]',
          iconLeft ? 'pl-11' : '',
          className,
        ].join(' ')}
      />
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
// PlanerTextarea — styled textarea (ditto)
// ───────────────────────────────────────────────────────────────

export function PlanerTextarea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...rest}
      className={`w-full rounded-xl border bg-transparent px-4 py-3 text-[15px] resize-none ${className}`}
    />
  );
}

// ───────────────────────────────────────────────────────────────
// StepRail — progress indicator at top of the create flow
// ───────────────────────────────────────────────────────────────

interface StepRailProps {
  steps: { label: string }[];
  current: number;
  onStepClick?: (i: number) => void;
}

export function StepRail({ steps, current, onStepClick }: StepRailProps) {
  return (
    <div className="flex items-center gap-2 w-full">
      {steps.map((step, i) => {
        const isActive = i === current;
        const isDone = i < current;
        const isClickable = isDone && onStepClick;
        return (
          <button
            key={step.label}
            type="button"
            disabled={!isClickable}
            onClick={() => isClickable && onStepClick?.(i)}
            className={[
              'flex-1 flex items-center gap-2 py-2 group transition-colors',
              isClickable ? 'cursor-pointer' : 'cursor-default',
            ].join(' ')}
          >
            <span
              className={[
                'w-2 h-2 rounded-full transition-all duration-300',
                isActive
                  ? 'bg-[color:var(--color-planer-accent)] step-active-dot'
                  : isDone
                  ? 'bg-[color:var(--color-planer-accent)]/70'
                  : 'bg-white/15',
              ].join(' ')}
            />
            <span
              className={[
                'text-[10px] uppercase tracking-[0.22em] transition-colors whitespace-nowrap truncate',
                isActive
                  ? 'text-[color:var(--color-planer-ink)]'
                  : isDone
                  ? 'text-[color:var(--color-planer-dim)] group-hover:text-[color:var(--color-planer-ink)]'
                  : 'text-[color:var(--color-planer-whisper)]',
              ].join(' ')}
            >
              <span className="editorial-num mr-1.5">{String(i + 1).padStart(2, '0')}</span>
              <span className="hidden sm:inline">{step.label}</span>
            </span>
            {i < steps.length - 1 && (
              <span className="flex-1 h-px bg-white/[0.06] ml-1" />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
// AvatarStack — stacked avatars with reveal animation
// ───────────────────────────────────────────────────────────────

interface Avatar { url: string | null; name: string }
interface AvatarStackProps {
  avatars: Avatar[];
  size?: number;
  max?: number;
}

export function AvatarStack({ avatars, size = 28, max = 4 }: AvatarStackProps) {
  const shown = avatars.slice(0, max);
  const rest = avatars.length - shown.length;
  // Separator ring: explicit dark (void) box-shadow gives each avatar a
  // clear cut-out edge regardless of the parent card's background color.
  // Using surface-color made the overlaps look glued when the parent
  // was also surface-colored (as on the PlanCard). Reduced overlap from
  // -size/3 to -size/3.5 gives the rings breathing room.
  const separator = `0 0 0 2px var(--color-planer-void)`;
  return (
    <div className="flex items-center">
      {shown.map((a, i) => (
        <div
          key={i}
          className="rounded-full overflow-hidden bg-[color:var(--color-planer-raised)] flex items-center justify-center text-[11px] font-medium text-[color:var(--color-planer-ink)]/70"
          style={{
            width: size, height: size,
            marginLeft: i === 0 ? 0 : -Math.round(size / 3.5),
            zIndex: shown.length - i,
            boxShadow: separator,
          }}
        >
          {a.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={a.url} alt="" className="w-full h-full object-cover" />
          ) : (
            a.name?.[0]?.toUpperCase() || '?'
          )}
        </div>
      ))}
      {rest > 0 && (
        <div
          className="rounded-full bg-[color:var(--color-planer-raised)] flex items-center justify-center text-[11px] font-medium text-[color:var(--color-planer-dim)]"
          style={{
            width: size, height: size,
            marginLeft: -Math.round(size / 3.5),
            boxShadow: separator,
          }}
        >
          +{rest}
        </div>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
// TiltingMap — Mapbox static image with parallax-on-scroll subtle tilt.
// Used inside PlanCard & hero. Pure decorative — accepts any src.
// ───────────────────────────────────────────────────────────────

interface TiltingMapProps {
  src: string;
  alt?: string;
  className?: string;
}

export function TiltingMap({ src, alt = '', className = '' }: TiltingMapProps) {
  // fn-15.5: useSpring-tracked rotation replaced with direct transform
  // writes + a CSS transition for the snap-back. The tilt at ≤8° is
  // close enough to a spring that users don't notice the missing
  // overshoot in a static map context.
  const innerRef = useRef<HTMLDivElement>(null);

  const setRotation = (rx: number, ry: number) => {
    const el = innerRef.current;
    if (el) {
      el.style.transform = `rotateY(${ry}deg) rotateX(${rx}deg)`;
    }
  };

  const handleMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setRotation(py * -6, px * -8); // subtle
  };

  const handleLeave = () => setRotation(0, 0);

  return (
    <div
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={`relative overflow-hidden ${className}`}
      style={{ perspective: 1000 }}
    >
      <div
        ref={innerRef}
        style={{
          transformStyle: 'preserve-3d',
          transition: 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        className="w-full h-full motion-reduce:!transition-none"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="w-full h-full object-cover scale-110" />
      </div>
      {/* Edge gradient for integration */}
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-[color:var(--color-planer-void)]/60 pointer-events-none" />
    </div>
  );
}
