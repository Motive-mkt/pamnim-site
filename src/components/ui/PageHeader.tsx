import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface Crumb {
  label: string;
  to?: string;
}

interface PageHeaderProps {
  title: ReactNode;
  eyebrow?: string;
  description?: ReactNode;
  breadcrumbs?: Crumb[];
  /** Optional slot under the description (meta, actions) */
  children?: ReactNode;
  className?: string;
}

/**
 * One header for every inner public page (services, categories, individual services, contact,
 * portfolio, legal) so they all share the same rhythm. Sits below the fixed 72px site header.
 */
export default function PageHeader({ title, eyebrow, description, breadcrumbs, children, className }: PageHeaderProps) {
  return (
    <section className={cn('border-b border-charcoal/[0.07] bg-paper pt-[72px]', className)}>
      <div className="container-x py-12 md:py-16">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-6">
            <ol className="flex flex-wrap items-center gap-1.5 text-sm text-charcoal/65">
              {breadcrumbs.map((crumb, i) => {
                const last = i === breadcrumbs.length - 1;
                return (
                  <li key={`${crumb.label}-${i}`} className="flex items-center gap-1.5">
                    {crumb.to && !last ? (
                      <Link to={crumb.to} className="hover:text-ochre hover:underline underline-offset-4">
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className={last ? 'font-medium text-charcoal' : undefined} aria-current={last ? 'page' : undefined}>
                        {crumb.label}
                      </span>
                    )}
                    {!last && <ChevronRight className="h-3.5 w-3.5 text-charcoal/35" aria-hidden="true" />}
                  </li>
                );
              })}
            </ol>
          </nav>
        )}

        {eyebrow && <p className="eyebrow mb-4">{eyebrow}</p>}
        <h1 className="max-w-[20ch] sm:max-w-3xl">{title}</h1>
        {description && <p className="lede mt-5">{description}</p>}
        {children && <div className="mt-8">{children}</div>}
      </div>
    </section>
  );
}
