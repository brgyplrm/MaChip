import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Search, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

const SearchableSelect = ({
  options = [],
  value = "",
  onChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  searchable = true,
  className = "",
  disabled = false,
  error = false,
  placement = "bottom", // "bottom" | "top" | "auto"
  menuClassName = "",
  id,
  name,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [actualPlacement, setActualPlacement] = useState(placement === "top" ? "top" : "bottom");
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);

  // Normalize options to { value, label, sublabel }
  const normalizedOptions = options.map((opt) => {
    if (typeof opt === "object" && opt !== null) {
      return {
        value: opt.value !== undefined ? opt.value.toString() : "",
        label: opt.label !== undefined ? opt.label.toString() : "",
        sublabel: opt.sublabel !== undefined ? opt.sublabel.toString() : "",
      };
    }
    return {
      value: opt !== undefined ? opt.toString() : "",
      label: opt !== undefined ? opt.toString() : "",
      sublabel: "",
    };
  });

  const selectedOption = normalizedOptions.find(
    (opt) => opt.value === (value !== undefined && value !== null ? value.toString() : "")
  );

  const filteredOptions = normalizedOptions.filter((opt) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      opt.label.toLowerCase().includes(term) ||
      opt.value.toLowerCase().includes(term) ||
      (opt.sublabel && opt.sublabel.toLowerCase().includes(term))
    );
  });

  // Handle focus and auto-scroll to selected option when opened
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        if (searchable) {
          searchInputRef.current?.focus();
        }
        if (listRef.current) {
          const selectedEl = listRef.current.querySelector('[aria-selected="true"]');
          if (selectedEl) {
            selectedEl.scrollIntoView({ block: "nearest" });
          }
        }
      }, 40);
      return () => clearTimeout(timer);
    } else {
      setSearchTerm("");
    }
  }, [isOpen, searchable]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Dynamic placement detection (flip to top if space below is insufficient)
  useEffect(() => {
    if (isOpen) {
      if (placement === "auto" && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        if (spaceBelow < 280 && spaceAbove > spaceBelow) {
          setActualPlacement("top");
        } else {
          setActualPlacement("bottom");
        }
      } else if (placement === "top") {
        setActualPlacement("top");
      } else {
        setActualPlacement("bottom");
      }
    }
  }, [isOpen, placement]);

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      setIsOpen(false);
    } else if (e.key === "Enter" && !isOpen) {
      e.preventDefault();
      setIsOpen(true);
    }
  };

  const handleSelect = (val) => {
    if (onChange) {
      onChange(val);
    }
    setIsOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className={cn("relative w-full text-left", isOpen ? "z-50" : "z-auto", className)}
      onKeyDown={handleKeyDown}
    >
      {/* Trigger Button - styled to exactly match shadcn SelectTrigger */}
      <button
        type="button"
        id={id}
        name={name}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-xs transition-colors hover:bg-slate-50 hover:border-slate-300 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 disabled:cursor-not-allowed disabled:opacity-50",
          error && "border-red-500 focus:border-red-500 focus:ring-red-500/20",
          isOpen && "border-brand-primary ring-2 ring-brand-primary/20"
        )}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span
          className={cn(
            "truncate font-medium",
            !selectedOption ? "text-slate-400 font-normal" : "text-slate-800"
          )}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200",
            isOpen && "rotate-180 text-brand-primary"
          )}
        />
      </button>

      {/* Dropdown Menu - styled to match shadcn SelectContent with elevated layering */}
      {isOpen && (
        <div
          className={cn(
            "absolute left-0 z-50 w-full min-w-[160px] rounded-md border border-slate-200 bg-white p-1 shadow-xl ring-1 ring-black/5 duration-100 animate-in fade-in-0 zoom-in-95",
            actualPlacement === "top" ? "bottom-full mb-1" : "top-full mt-1",
            menuClassName
          )}
        >
          {/* Optional Search Box */}
          {searchable && (
            <div className="relative mb-1 px-1 pt-0.5">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-md border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-brand-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}

          {/* Scrollable Items Viewport with native smooth scrollbar */}
          <div
            ref={listRef}
            role="listbox"
            className="max-h-60 overflow-y-auto overflow-x-hidden space-y-0.5 pr-0.5 text-xs overscroll-contain"
          >
            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400">
                No matching results
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === (value !== undefined && value !== null ? value.toString() : "");
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(opt.value)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-sm px-2.5 py-1.5 text-left text-xs transition-colors",
                      isSelected
                        ? "bg-brand-primary/10 text-brand-primary font-semibold"
                        : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                    )}
                  >
                    <div className="truncate pr-2">
                      <span className="block truncate">{opt.label}</span>
                      {opt.sublabel && (
                        <span className="block truncate text-[10px] text-slate-400">
                          {opt.sublabel}
                        </span>
                      )}
                    </div>
                    {isSelected && (
                      <Check className="h-3.5 w-3.5 shrink-0 text-brand-primary" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
