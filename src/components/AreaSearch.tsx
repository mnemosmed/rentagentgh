import { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { useAllAreas } from '@/hooks/useAgents';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AreaSearchProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  placeholder?: string;
  className?: string;
  onInputFocus?: () => void;
}

export interface AreaSearchRef {
  closeDropdown: () => void;
}

export const AreaSearch = forwardRef<AreaSearchRef, AreaSearchProps>(
  ({ value, onChange, onSearch, placeholder = "Search by area...", className, onInputFocus }, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredAreas, setFilteredAreas] = useState<string[]>([]);
  const [isUserTyping, setIsUserTyping] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { data: allAreas = [] } = useAllAreas();

  // Expose closeDropdown to parent
  useImperativeHandle(ref, () => ({
    closeDropdown: () => setIsOpen(false),
  }));

  // Update filtered areas when value or allAreas changes
  useEffect(() => {
    if (value) {
      const filtered = allAreas.filter(area =>
        area.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredAreas(filtered);
      // Only open dropdown if user is actively typing
      if (isUserTyping && filtered.length > 0) {
        setIsOpen(true);
      }
    } else {
      setFilteredAreas(allAreas);
      setIsOpen(false);
    }
  }, [value, allAreas, isUserTyping]);

  // Reset typing state when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      setIsUserTyping(false);
    }
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (area: string) => {
    onChange(area);
    setIsOpen(false);
    inputRef.current?.blur();
    // Track area selection
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('datafast:goal', {
        detail: {
          goal: 'area_selected',
          params: { area_name: area }
        }
      }));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      trackSearch();
      onSearch();
      setIsOpen(false);
    }
  };

  const trackSearch = () => {
    // Fire Datafast custom event via global window object
    if (typeof window !== 'undefined' && value.trim()) {
      window.dispatchEvent(new CustomEvent('datafast:goal', {
        detail: {
          goal: 'area_search',
          params: { search_term: value.trim() }
        }
      }));
    }
  };

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            setIsUserTyping(true);
            onChange(e.target.value);
          }}
          onFocus={() => {
            if (onInputFocus) {
              onInputFocus();
            }
            // Always show suggestions when focusing, even with onInputFocus handler
            if (filteredAreas.length > 0) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full h-14 pl-12 pr-12 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-lg transition-all"
        />
        {value && (
          <button
            onClick={() => onChange('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {isOpen && filteredAreas.length > 0 && (
        <div className="absolute z-50 w-full mt-2 py-2 bg-popover border border-border rounded-xl shadow-lg max-h-64 overflow-y-auto">
          {filteredAreas.map((area) => (
            <button
              key={area}
              onClick={() => handleSelect(area)}
              className="w-full px-4 py-2.5 text-left hover:bg-muted transition-colors text-foreground"
            >
              {area}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

AreaSearch.displayName = 'AreaSearch';
