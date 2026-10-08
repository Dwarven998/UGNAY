// features/media/components/AssetBrowser.tsx
import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import type { MediaAsset } from '../../../types';
import { SORT_OPTIONS, VIEW_OPTIONS, defaultSortDir, formatBytes, formatDate, isImageAsset, isVideoAsset, typeLabel } from './assetView';
import type { SortDir, SortKey, TypeFilter, ViewMode } from './assetView';
import './assetBrowser.css';

// ── Toolbar ──

interface MenuGroup {
  options: { value: string; label: string }[];
  selected: string;
  onSelect: (value: string) => void;
}

function ToolbarMenu({ icon, label, valueLabel, groups }: { icon: ReactNode; label: string; valueLabel: string; groups: MenuGroup[] }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const menu = menuRef.current;
    (menu?.querySelector<HTMLElement>('[aria-checked="true"]') ?? menu?.querySelector<HTMLElement>('[role="menuitemradio"]'))?.focus();
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onMenuKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? []);
    const index = items.indexOf(document.activeElement as HTMLElement);
    const focusAt = (i: number) => items[(i + items.length) % items.length]?.focus();
    if (e.key === 'ArrowDown') { e.preventDefault(); focusAt(index + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusAt(index - 1); }
    else if (e.key === 'Home') { e.preventDefault(); focusAt(0); }
    else if (e.key === 'End') { e.preventDefault(); focusAt(items.length - 1); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'Tab') setOpen(false);
  };

  return (
    <div className="ab-menu" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className={`ab-menu-btn ${open ? 'ab-menu-btn-open' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen(o => !o)}
        onKeyDown={e => {
          if (e.key === 'ArrowDown' && !open) { e.preventDefault(); setOpen(true); }
        }}
      >
        {icon}
        <span className="ab-menu-btn-label">{label}:</span>
        <span className="ab-menu-btn-value">{valueLabel}</span>
        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div ref={menuRef} id={menuId} className="ab-menu-list" role="menu" aria-label={label} onKeyDown={onMenuKeyDown}>
          {groups.map((group, gi) => (
            <div key={gi} role="group" className={gi > 0 ? 'ab-menu-group-sep' : undefined}>
              {group.options.map(option => {
                const checked = option.value === group.selected;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={checked}
                    tabIndex={-1}
                    className="ab-menu-item"
                    onClick={() => { group.onSelect(option.value); close(); }}
                  >
                    <span className="ab-menu-check" aria-hidden="true">
                      {checked && (
                        <svg width="14" height="14" fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l3 3 7-7" />
                        </svg>
                      )}
                    </span>
                    {option.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'image', label: 'Images' },
  { value: 'video', label: 'Videos' },
];

/** Search on the left; type filter, sort and view on the right. `arrange={false}` leaves only the search (AI results keep their ranking). */
export function AssetToolbar({
  search, arrange = true, view, sortKey, sortDir, typeFilter, typeCounts, onViewChange, onSortChange, onTypeFilterChange,
}: {
  search: ReactNode;
  arrange?: boolean;
  view: ViewMode;
  sortKey: SortKey;
  sortDir: SortDir;
  typeFilter: TypeFilter;
  typeCounts: Record<TypeFilter, number>;
  onViewChange: (view: ViewMode) => void;
  onSortChange: (key: SortKey, dir: SortDir) => void;
  onTypeFilterChange: (type: TypeFilter) => void;
}) {
  const sortLabel = SORT_OPTIONS.find(o => o.value === sortKey)?.label ?? '';
  const dirOptions = sortKey === 'name' || sortKey === 'type'
    ? [{ value: 'asc', label: 'Ascending (A → Z)' }, { value: 'desc', label: 'Descending (Z → A)' }]
    : sortKey === 'date'
      ? [{ value: 'desc', label: 'Newest first' }, { value: 'asc', label: 'Oldest first' }]
      : [{ value: 'desc', label: 'Largest first' }, { value: 'asc', label: 'Smallest first' }];

  return (
    <div className="ab-toolbar">
      <div className="ab-toolbar-search">{search}</div>
      {arrange && (
        <div className="ab-toolbar-controls">
          <div className="ab-segmented" role="radiogroup" aria-label="File type">
            {TYPE_FILTERS.map(option => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={typeFilter === option.value}
                className="ab-segmented-btn"
                onClick={() => onTypeFilterChange(option.value)}
              >
                {option.label}
                <span className="ab-segmented-count">{typeCounts[option.value]}</span>
              </button>
            ))}
          </div>
          <ToolbarMenu
            label="Sort by"
            valueLabel={`${sortLabel} ${sortDir === 'asc' ? '↑' : '↓'}`}
            icon={
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
              </svg>
            }
            groups={[
              { options: SORT_OPTIONS, selected: sortKey, onSelect: v => onSortChange(v as SortKey, defaultSortDir(v as SortKey)) },
              { options: dirOptions, selected: sortDir, onSelect: v => onSortChange(sortKey, v as SortDir) },
            ]}
          />
          <ToolbarMenu
            label="View"
            valueLabel={VIEW_OPTIONS.find(o => o.value === view)?.label ?? ''}
            icon={
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            }
            groups={[{ options: VIEW_OPTIONS, selected: view, onSelect: v => onViewChange(v as ViewMode) }]}
          />
        </div>
      )}
    </div>
  );
}

// ── Asset collection ──

export interface AssetRowHandlers {
  onCaption: (asset: MediaAsset) => void;
  onUseInPost: (asset: MediaAsset) => void;
  onDelete: (asset: MediaAsset) => void;
}

interface AssetCollectionProps extends AssetRowHandlers {
  assets: MediaAsset[];
  view: ViewMode;
  sortKey: SortKey;
  sortDir: SortDir;
  /** Omit to make the Details headers plain labels (e.g. ranked AI results). */
  onSortChange?: (key: SortKey, dir: SortDir) => void;
  selectedIds: Set<string>;
  /** `range` = shift-click: select everything between the last clicked file and this one. */
  onToggleSelect: (asset: MediaAsset, range: boolean) => void;
  onToggleAll: () => void;
  onOpen: (asset: MediaAsset) => void;
  /** Extra per-file info, e.g. AI match score and reason. */
  annotations?: Map<string, { badge: string; note: string }>;
}

const ROW_ICONS = {
  caption: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z',
  post: 'M12 4v16m8-8H4',
  delete: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
};

/** Icon buttons in the Details view's Actions column. */
function RowActions({ asset, handlers }: { asset: MediaAsset; handlers: AssetRowHandlers }) {
  const actions: { key: keyof typeof ROW_ICONS; label: string; run: (asset: MediaAsset) => void; tone: string }[] = [
    { key: 'caption', label: 'Caption Studio', run: handlers.onCaption, tone: 'primary' },
    ...(isImageAsset(asset) ? [{ key: 'post' as const, label: 'Use in Post', run: handlers.onUseInPost, tone: 'primary' }] : []),
    { key: 'delete', label: 'Delete', run: handlers.onDelete, tone: 'danger' },
  ];
  return (
    <>
      {actions.map(action => (
        <button
          key={action.key}
          type="button"
          onClick={() => action.run(asset)}
          className={`ab-row-btn ab-row-btn-${action.tone}`}
          aria-label={`${action.label}: ${asset.fileName}`}
          title={action.label}
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d={ROW_ICONS[action.key]} />
          </svg>
        </button>
      ))}
    </>
  );
}

function Thumbnail({ asset }: { asset: MediaAsset }) {
  return isImageAsset(asset) ? (
    <img src={asset.fileUrl} alt="" loading="lazy" />
  ) : (
    <video src={asset.fileUrl} preload="metadata" muted aria-hidden="true">
      <track kind="captions" label="Preview captions" srcLang="en" src="" />
    </video>
  );
}

function CheckButton({ asset, checked, inline, onToggle }: {
  asset: MediaAsset; checked: boolean; inline?: boolean; onToggle: (asset: MediaAsset, range: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={`Select ${asset.fileName}`}
      className={`ab-check ${checked ? 'ab-check-on' : ''} ${inline ? 'ab-check-inline' : ''}`}
      onClick={e => { e.stopPropagation(); onToggle(asset, e.shiftKey); }}
    >
      <svg width="12" height="12" fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth={3} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l3 3 7-7" />
      </svg>
    </button>
  );
}

const VideoBadge = () => (
  <span className="ab-video-badge" aria-hidden="true">
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
  </span>
);

export function AssetCollection({
  assets, view, sortKey, sortDir, onSortChange, selectedIds, onToggleSelect, onToggleAll, onOpen, annotations, ...handlers
}: AssetCollectionProps) {
  // Once anything is selected, clicking a file adds/removes it instead of opening it (like Google Photos / Drive).
  const selecting = selectedIds.size > 0;
  const activate = (asset: MediaAsset, shiftKey: boolean) => (selecting ? onToggleSelect(asset, shiftKey) : onOpen(asset));
  const openLabel = (asset: MediaAsset) =>
    selecting ? `${selectedIds.has(asset.id) ? 'Deselect' : 'Select'} ${asset.fileName}` : `Open ${asset.fileName}`;
  const containerClass = selecting ? 'ab-selecting' : '';

  if (view === 'list') {
    return (
      <div className={`ab-list ${containerClass}`}>
        {assets.map(asset => {
          const checked = selectedIds.has(asset.id);
          return (
            <div key={asset.id} className={`ab-list-item ${checked ? 'ab-item-selected' : ''}`}>
              <CheckButton asset={asset} checked={checked} inline onToggle={onToggleSelect} />
              <button type="button" className="ab-row-open" onClick={e => activate(asset, e.shiftKey)} aria-label={openLabel(asset)}>
                <span className="ab-thumb"><Thumbnail asset={asset} /></span>
                <span className="ab-name" title={asset.fileName}>{asset.fileName}</span>
                {isVideoAsset(asset) && <VideoBadge />}
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  if (view === 'details') {
    const allSelected = assets.length > 0 && assets.every(a => selectedIds.has(a.id));
    let headCheckState: boolean | 'mixed' = false;
    if (allSelected) headCheckState = true;
    else if (selecting) headCheckState = 'mixed';
    const header = (key: SortKey, label: string, className = '') => {
      if (!onSortChange) return <span className={`ab-details-label ${className}`}>{label}</span>;
      const active = sortKey === key;
      const nextDir: SortDir = sortDir === 'asc' ? 'desc' : 'asc';
      return (
        <button
          type="button"
          className={`ab-details-sort ${active ? 'ab-details-sort-active' : ''} ${className}`}
          onClick={() => onSortChange(key, active ? nextDir : defaultSortDir(key))}
          aria-label={`Sort by ${label}${active ? `, currently ${sortDir === 'asc' ? 'ascending' : 'descending'}` : ''}`}
        >
          {label}
          <span className="ab-details-arrow" aria-hidden="true">{active && (sortDir === 'asc' ? '↑' : '↓')}</span>
        </button>
      );
    };
    return (
      <div className={`ab-details ${containerClass}`}>
        <div className="ab-details-head">
          <div className="ab-details-name">
            <button
              type="button"
              role="checkbox"
              aria-checked={headCheckState}
              aria-label="Select all"
              className={`ab-check ab-check-inline ab-check-head ${headCheckState === true ? 'ab-check-on' : ''} ${headCheckState === 'mixed' ? 'ab-check-mixed' : ''}`}
              onClick={onToggleAll}
            >
              <svg width="12" height="12" fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth={3} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d={allSelected ? 'M5 10l3 3 7-7' : 'M5 10h10'} />
              </svg>
            </button>
            {header('name', 'Name')}
          </div>
          {header('type', 'Type', 'ab-col-type')}
          {header('size', 'Size', 'ab-col-size')}
          {header('date', 'Date uploaded', 'ab-col-date')}
          <span className="ab-details-actions-head">Actions</span>
        </div>
        {assets.map(asset => {
          const checked = selectedIds.has(asset.id);
          return (
            <div key={asset.id} className={`ab-details-row ${checked ? 'ab-item-selected' : ''}`}>
              <div className="ab-details-name">
                <CheckButton asset={asset} checked={checked} inline onToggle={onToggleSelect} />
                <button type="button" className="ab-row-open" onClick={e => activate(asset, e.shiftKey)} aria-label={openLabel(asset)}>
                  <span className="ab-thumb"><Thumbnail asset={asset} /></span>
                  <span className="ab-name" title={asset.fileName}>{asset.fileName}</span>
                </button>
              </div>
              <span className="ab-col-type"><span className="mr-asset-type">{typeLabel(asset)}</span></span>
              <span className="ab-col-size ab-muted">{formatBytes(asset.fileSize)}</span>
              <span className="ab-col-date ab-muted">{formatDate(asset.createdAt)}</span>
              <div className="ab-row-actions">
                <RowActions asset={asset} handlers={handlers} />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Icon views
  return (
    <div className={`mr-assets-grid ab-grid-${view} ${containerClass}`}>
      {assets.map((asset, i) => {
        const checked = selectedIds.has(asset.id);
        const note = annotations?.get(asset.id);
        let caption: ReactNode = null;
        if (note) caption = <p className="mr-ai-reason">{note.note}</p>;
        else if (view !== 'small') caption = <span className="mr-asset-type">{typeLabel(asset)}</span>;
        return (
          <div
            key={asset.id}
            className={`mr-asset-card ab-card ${checked ? 'ab-item-selected' : ''}`}
            style={{ animationDelay: `${Math.min(i, 12) * 0.03}s` }}
          >
            <div className="mr-asset-preview">
              <button type="button" className="ab-card-open" onClick={e => activate(asset, e.shiftKey)} aria-label={openLabel(asset)}>
                <Thumbnail asset={asset} />
              </button>
              {note && <span className="mr-ai-score-badge">{note.badge}</span>}
              {isVideoAsset(asset) && <VideoBadge />}
              <CheckButton asset={asset} checked={checked} onToggle={onToggleSelect} />
            </div>
            <div className={`mr-asset-info ${note ? 'mr-asset-info-reason' : ''}`}>
              <p className="mr-asset-name" title={asset.fileName}>{asset.fileName}</p>
              {caption}
            </div>
          </div>
        );
      })}
    </div>
  );
}
