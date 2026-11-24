import { useEffect, useState } from 'react';
import { listCities, listCountries, listStates, type GeoOption } from '@/lib/geo-data';
import { QuietSpinner } from '@/components/ui/quiet-spinner';

type Level = 'country' | 'state' | 'city';

async function loadOptions(level: Level, countryCode: string, stateCode: string): Promise<GeoOption[]> {
  if (level === 'country') return listCountries();
  if (level === 'state') return listStates(countryCode);
  return listCities(countryCode, stateCode);
}

export function LocationChoice({
  level, countryCode, stateCode, value, onSelect, onSkip,
}: {
  level: Level;
  countryCode: string;
  stateCode: string;
  value: string;
  onSelect: (option: GeoOption) => void;
  onSkip?: () => void;
}) {
  const [options, setOptions] = useState<GeoOption[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const title = level === 'country' ? 'Search all countries' : level === 'state' ? 'Search states or regions' : 'Search cities';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadFailed(false);
    setOptions([]);
    setFilter('');
    loadOptions(level, countryCode, stateCode).then(result => {
      if (!cancelled) { setOptions(result); setLoading(false); }
    }).catch(() => {
      if (!cancelled) { setLoadFailed(true); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [level, countryCode, stateCode]);

  const visible = options.filter(option => option.name.toLocaleLowerCase().includes(filter.trim().toLocaleLowerCase())).slice(0, 80);
  const emptyText = level === 'state'
    ? 'No states or regions are listed for this country. You can continue without one.'
    : 'No cities are listed for this location. You can continue without one.';

  return <div className="space-y-3">
    {value && <p className="text-sm font-semibold text-foreground" role="status">Selected: {value}</p>}
    <label className="sr-only" htmlFor={`location-search-${level}`}>{title}</label>
    <input id={`location-search-${level}`} data-testid={`input-onboarding-${level}-search`} value={filter} onChange={event => setFilter(event.target.value)} placeholder={title} autoComplete="off" className="field"/>
    {loading ? <div role="status" aria-label="Loading" className="flex justify-center py-2"><QuietSpinner size={18}/></div>
      : loadFailed ? <div role="alert" className="space-y-3"><p className="text-sm text-rose-300">Location names could not be loaded. Check your connection and try again.</p><button type="button" onClick={() => {setLoadFailed(false);setLoading(true);void loadOptions(level,countryCode,stateCode).then(setOptions).catch(()=>setLoadFailed(true)).finally(()=>setLoading(false))}} className="rounded-lg bg-secondary px-4 py-2 text-xs font-semibold">Try again</button></div>
      : visible.length ? <div role="listbox" aria-label={title} className="max-h-60 overflow-y-auto rounded-xl border border-white/10 bg-[#18151d] p-1">
        {visible.map(option => <button type="button" role="option" aria-selected={option.name === value} key={`${option.code}:${option.name}`} onClick={() => onSelect(option)} data-testid={`option-onboarding-${level}-${option.name.toLowerCase().replaceAll(/[^a-z0-9]+/g,'-')}`} className={`block w-full rounded-lg px-3 py-2.5 text-left text-sm hover:bg-white/[.06] ${option.name===value?'bg-accent text-primary':'text-foreground'}`}>{option.name}</button>)}
      </div>
      : options.length ? <p className="text-xs text-muted-foreground">No names match “{filter}”. Try another search.</p>
        : level !== 'country' && onSkip ? <div className="space-y-3"><p className="text-xs leading-5 text-muted-foreground">{emptyText} No city or region has been invented.</p><button type="button" onClick={onSkip} className="rounded-lg border border-white/10 px-4 py-2.5 text-sm font-semibold">Continue without {level === 'state' ? 'a state or region' : 'a city'}</button></div>
          : <p className="text-xs text-muted-foreground">No real country names are available. Check your connection, then try again.</p>}
  </div>;
}
