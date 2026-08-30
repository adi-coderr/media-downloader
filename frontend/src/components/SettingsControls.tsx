import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface SettingsRowProps {
  icon: LucideIcon;
  label: string;
  description?: string;
  children: ReactNode;
}

export function SettingsRow({ icon: Icon, label, description, children }: SettingsRowProps): JSX.Element {
  return (
    <div className="flex flex-col gap-4 border-b border-glass-border py-5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div>
          <p className="font-medium text-white">{label}</p>
          {description && <p className="mt-0.5 text-sm text-white/40">{description}</p>}
        </div>
      </div>
      <div className="sm:min-w-[220px]">{children}</div>
    </div>
  );
}

interface SelectFieldProps<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}

export function SelectField<T extends string>({ value, options, onChange }: SelectFieldProps<T>): JSX.Element {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
      className="w-full rounded-xl border border-glass-border bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition-colors focus:border-primary/60 sm:w-auto"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value} className="bg-primary/5 text-primary">
          {option.label}
        </option>
      ))}
    </select>
  );
}

interface ToggleFieldProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function ToggleField({ checked, onChange }: ToggleFieldProps): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 rounded-full transition-colors duration-300 ${checked ? 'bg-primary' : 'bg-white/10'}`}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="absolute top-1 h-5 w-5 rounded-full bg-white shadow"
        style={{ left: checked ? '26px' : '4px' }}
      />
    </button>
  );
}

interface TextFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function TextField({ value, onChange, placeholder }: TextFieldProps): JSX.Element {
  return (
    <input
      type="text"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl border border-glass-border bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-primary/60 sm:w-64"
    />
  );
}
