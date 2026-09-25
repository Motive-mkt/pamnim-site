import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils';

interface BrandIconBoxProps {
  icon: LucideIcon;
  className?: string;
  iconClassName?: string;
}

export default function BrandIconBox({
  icon: Icon,
  className,
  iconClassName
}: BrandIconBoxProps) {
  return (
    <div className={cn("brand-icon-box", className)}>
      <Icon className={cn("w-5 h-5", iconClassName)} />
    </div>
  );
}
