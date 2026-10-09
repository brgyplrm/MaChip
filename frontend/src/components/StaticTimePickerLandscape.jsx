import React, { useState, useMemo } from 'react';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { StaticTimePicker } from '@mui/x-date-pickers/StaticTimePicker';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import dayjs from 'dayjs';

// MAChip primary brand theme for Material-UI components
const machipTimeTheme = createTheme({
  palette: {
    primary: {
      main: '#2a174e',
      light: '#432874',
      dark: '#1a0e30',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#abbb44',
    },
  },
  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
});

// Helper to convert "HH:mm" strings or Dayjs instances into Dayjs with a synchronized reference date
const parseToDayjs = (val, refBase) => {
  if (!val) return null;
  const base = refBase && dayjs.isDayjs(refBase) ? refBase : dayjs();
  if (dayjs.isDayjs(val)) {
    return base.hour(val.hour()).minute(val.minute()).second(0).millisecond(0);
  }
  if (typeof val === 'string' && val.includes(':')) {
    const parts = val.split(':').map(Number);
    if (!isNaN(parts[0]) && !isNaN(parts[1])) {
      return base.hour(parts[0]).minute(parts[1]).second(0).millisecond(0);
    }
  }
  const parsed = dayjs(val);
  return parsed.isValid() ? base.hour(parsed.hour()).minute(parsed.minute()).second(0).millisecond(0) : null;
};

// Helper to format string into 12-hour AM/PM label
const format12Hour = (val) => {
  if (!val) return '--:--';
  const d = parseToDayjs(val);
  return d ? d.format('hh:mm A') : '--:--';
};

// Preset quick-selection buttons for rapid employee entry
const getPresetsForField = (name, minTime) => {
  const n = (name || '').toLowerCase();
  if (n.includes('from') || n === 'hrfrom') {
    if (minTime === '12:30') {
      return ['12:30', '13:00', '13:30', '14:00', '15:00'];
    }
    return ['17:30', '18:00', '18:30', '19:00'];
  }
  if (n.includes('to') || n === 'hrto') {
    if (minTime === '12:30') {
      return ['16:00', '17:00', '17:30', '18:00'];
    }
    return ['19:00', '19:30', '20:00', '21:00', '22:00'];
  }
  if (n.includes('in') || n === 'claimedin') {
    return ['07:30', '08:00', '08:30', '09:00'];
  }
  if (n.includes('out') || n === 'claimedout') {
    return ['17:00', '17:30', '18:00', '18:30'];
  }
  return ['08:00', '12:00', '17:00', '18:00'];
};

// Smart default business hours when value is unset (prevents midnight / 2 AM default)
const getSmartDefaultTime = (name, minTime) => {
  const n = (name || '').toLowerCase();
  if (n.includes('from') || n === 'hrfrom') {
    return minTime || '17:30';
  }
  if (n.includes('to') || n === 'hrto') {
    return '19:30';
  }
  if (n.includes('in') || n === 'claimedin') {
    return '08:00';
  }
  if (n.includes('out') || n === 'claimedout') {
    return '17:00';
  }
  return '08:00';
};

/**
 * StaticTimePickerLandscape
 * 
 * Landscape Material-UI Static Time Picker with:
 * 1. Dual-Time Tabbed Switcher (Option A) with independent state per tab
 * 2. Automatic Overtime hours normalization (maps clicks to valid PM quadrant)
 * 3. Quick preset selection buttons for 1-click filing
 * 4. Two-way binding compatible with standard form handlers
 */
export default function StaticTimePickerLandscape({
  items,
  label,
  name,
  value,
  onChange,
  minTime,
  maxTime,
  disabled = false,
  className = '',
  helperText,
  activeTab: controlledActiveTab,
  onTabChange,
  ...pickerProps
}) {
  const isDualMode = Array.isArray(items) && items.length > 0;
  const [internalActiveTab, setInternalActiveTab] = useState(0);

  const activeTab = controlledActiveTab !== undefined ? controlledActiveTab : internalActiveTab;
  const handleTabSelect = (idx) => {
    setInternalActiveTab(idx);
    if (typeof onTabChange === 'function') {
      onTabChange(idx);
    }
  };

  // Active configuration based on single vs dual mode
  const currentItem = useMemo(() => {
    if (isDualMode) {
      return items[activeTab] || items[0];
    }
    return {
      label: label || 'Time',
      name: name || 'time',
      value: value,
      minTime: minTime,
      maxTime: maxTime,
      disabled: disabled,
      helperText: helperText,
    };
  }, [isDualMode, items, activeTab, label, name, value, minTime, maxTime, disabled, helperText]);

  // Reference base date
  const todayBase = useMemo(() => dayjs(), []);

  // Compute smart fallback so clock face opens in correct business quadrant (not midnight/early AM)
  const smartDefault = useMemo(() => {
    return getSmartDefaultTime(currentItem.name, currentItem.minTime);
  }, [currentItem.name, currentItem.minTime]);

  // Active Dayjs value passed to StaticTimePicker
  const currentDayjsValue = useMemo(() => {
    if (currentItem.value) {
      return parseToDayjs(currentItem.value, todayBase);
    }
    // Default clock position to business default (e.g. 5:30 PM for OT, 8:00 AM for check-in)
    return parseToDayjs(smartDefault, todayBase);
  }, [currentItem.value, smartDefault, todayBase]);

  // Handles clock face selection
  const handleTimeChange = (newDayjs) => {
    if (!newDayjs || !dayjs.isDayjs(newDayjs) || !newDayjs.isValid()) return;

    let targetHour = newDayjs.hour();
    let targetMinute = newDayjs.minute();

    // Overtime hours normalization:
    // If user clicked hours on clock face in overtime context, normalize to afternoon/night (PM)
    const isOT =
      currentItem.name === 'hrFrom' ||
      currentItem.name === 'hrTo' ||
      currentItem.name === 'HrFrom' ||
      currentItem.name === 'HrTo' ||
      (currentItem.label || '').toLowerCase().includes('overtime');

    if (isOT) {
      // In overtime, hours between 1 and 11 clicked in AM should map to PM (13:00 to 23:00)
      if (targetHour >= 1 && targetHour <= 11) {
        targetHour += 12;
      }
      // If hrFrom selected at 17:00 and minimum is 17:30, auto-clamp minute to 30
      if ((currentItem.name === 'hrFrom' || currentItem.name === 'HrFrom') && targetHour === 17 && currentItem.minTime === '17:30' && targetMinute < 30) {
        targetMinute = 30;
      }
      // If hrTo selected at 22:00, cap minute to 00
      if ((currentItem.name === 'hrTo' || currentItem.name === 'HrTo') && targetHour === 22 && targetMinute > 0) {
        targetMinute = 0;
      }
    }

    const normalizedDayjs = todayBase.hour(targetHour).minute(targetMinute).second(0);
    const time24h = normalizedDayjs.format('HH:mm');

    const syntheticEvent = {
      target: {
        name: currentItem.name,
        value: time24h,
      },
    };

    if (typeof currentItem.onChange === 'function') {
      currentItem.onChange(syntheticEvent);
    } else if (typeof onChange === 'function') {
      onChange(syntheticEvent);
    }
  };

  // Quick preset button click handler
  const handlePresetSelect = (presetTime) => {
    const syntheticEvent = {
      target: {
        name: currentItem.name,
        value: presetTime,
      },
    };
    if (typeof currentItem.onChange === 'function') {
      currentItem.onChange(syntheticEvent);
    } else if (typeof onChange === 'function') {
      onChange(syntheticEvent);
    }
  };

  // Available presets for active field
  const presets = useMemo(() => {
    return getPresetsForField(currentItem.name, currentItem.minTime);
  }, [currentItem.name, currentItem.minTime]);

  return (
    <ThemeProvider theme={machipTimeTheme}>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <div className={`space-y-3 ${className}`}>
          {/* Dual Tabs for Paired Time Selection (Option A) */}
          {isDualMode && (
            <div className="flex flex-col sm:flex-row gap-2 p-1.5 bg-slate-100/80 rounded-xl border border-slate-200">
              {items.map((item, idx) => {
                const isSelected = activeTab === idx;
                const formatted = format12Hour(item.value);
                return (
                  <button
                    key={item.name || idx}
                    type="button"
                    onClick={() => handleTabSelect(idx)}
                    className={`flex-1 flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                      isSelected
                        ? 'bg-brand-primary text-white shadow-sm ring-2 ring-brand-primary/20'
                        : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200/80'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-amber-400' : 'bg-slate-300'}`} />
                      <span>{item.label}</span>
                    </div>
                    <span
                      className={`font-mono text-xs px-2 py-0.5 rounded font-semibold ${
                        isSelected ? 'bg-white/20 text-white font-bold' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {formatted}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Single Label when not in dual mode */}
          {!isDualMode && label && (
            <div className="flex items-center justify-between px-1">
              <label className="text-sm font-bold text-slate-700">{label}</label>
              <span className="text-xs font-mono font-semibold px-2 py-0.5 bg-slate-100 rounded text-slate-700">
                {format12Hour(value)}
              </span>
            </div>
          )}

          {/* Quick Presets Strip */}
          {presets.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap px-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Quick Presets:</span>
              {presets.map((preset) => {
                const isCurrent = currentItem.value === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handlePresetSelect(preset)}
                    className={`px-2.5 py-1 text-xs rounded-md font-mono font-medium transition-all ${
                      isCurrent
                        ? 'bg-brand-primary text-white font-bold shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80 border border-slate-200'
                    }`}
                  >
                    {format12Hour(preset)}
                  </button>
                );
              })}
            </div>
          )}

          {/* MUI Static Landscape Time Picker - default layout, ready for custom styling */}
          <div className="border border-slate-200 rounded-2xl overflow-x-auto bg-white shadow-xs custom-scrollbar">
            <StaticTimePicker
              key={`${currentItem.name}-${activeTab}`}
              orientation="landscape"
              value={currentDayjsValue}
              onChange={handleTimeChange}
              disabled={currentItem.disabled || disabled}
              slotProps={{
                actionBar: {
                  actions: [], // continuous inline interaction
                },
                ...(pickerProps.slotProps || {}),
              }}
              {...pickerProps}
            />
          </div>

          {/* Hidden inputs to guarantee presence in form inspection / serialize */}
          {isDualMode ? (
            items.map((it) => (
              <input key={it.name} type="hidden" name={it.name} value={it.value || ''} />
            ))
          ) : (
            <input type="hidden" name={name || 'time'} value={value || ''} />
          )}

          {/* Helper / Policy Guidance banner */}
          {currentItem.helperText && (
            <p className="text-xs text-slate-500 px-1 font-medium flex items-center gap-1.5">
              <span>ℹ️</span> {currentItem.helperText}
            </p>
          )}

          {/* Dual Mode Range Summary */}
          {isDualMode && items.length === 2 && (items[0].value || items[1].value) && (
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <span className="text-slate-500 font-medium">Selected Range:</span>
              <span className="font-mono font-bold text-brand-primary">
                {format12Hour(items[0].value)} &rarr; {format12Hour(items[1].value)}
              </span>
            </div>
          )}
        </div>
      </LocalizationProvider>
    </ThemeProvider>
  );
}
