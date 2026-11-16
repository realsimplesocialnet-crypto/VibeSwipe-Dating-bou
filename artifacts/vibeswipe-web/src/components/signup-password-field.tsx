import { useId, useRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export function SignupPasswordField({ value, onChange }: {
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [visible, setVisible] = useState(true);

  function toggle() {
    // Safari autofill can update the DOM before React receives its change event.
    if (input.current) onChange(input.current.value);
    setVisible((wasVisible) => !wasVisible);
  }

  return <div className="grid gap-2">
    <label htmlFor={id} className="text-xs font-semibold text-[#e7dce3]">Password</label>
    <div className="relative">
      <input ref={input} id={id} name="password" data-testid="input-signup-password"
        type={visible ? 'text' : 'password'} autoComplete="new-password"
        autoCapitalize="none" autoCorrect="off" spellCheck={false} required
        value={value} onChange={(event) => onChange(event.currentTarget.value)}
        onInput={(event) => onChange(event.currentTarget.value)}
        className="field min-h-12 pr-24 text-base signup-password"
        style={{ WebkitTextSecurity: visible ? 'none' : 'disc' } as React.CSSProperties}
        minLength={15} placeholder="At least 15 characters" aria-describedby={`${id}-visibility`}/>
      <button type="button" onPointerDown={(event) => event.preventDefault()} onClick={toggle}
        data-testid="button-toggle-signup-password" aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible} aria-controls={id}
        className="absolute inset-y-0 right-1 z-10 flex min-w-20 touch-manipulation items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-foreground">
        {visible ? <EyeOff size={18}/> : <Eye size={18}/>}
        {visible ? 'Hide' : 'Show'}
      </button>
    </div>
    <span id={`${id}-visibility`} className="text-xs text-muted-foreground">{visible ? 'Password is visible.' : 'Password is hidden.'}</span>
  </div>;
}
