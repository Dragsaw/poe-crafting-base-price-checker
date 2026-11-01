import './pick-up-filter.css';

import { Modal, type ModalProps } from '@mantine/core';
import { useClipboard } from '@mantine/hooks';
import { pickUpPurposes, type PickUpInput } from '@poe/core';
import { useCallback, useId, useMemo, useState, type CSSProperties, type JSX, type ReactNode } from 'react';

import { OpenSignMark, VerdictMark } from '../marks/marks';
import { colors, floatingShadows, headerControls, px, rounded, stacks, typeRoles, typeStyle } from '../theme/tokens';
import {
  COPIED_LABEL,
  COPIED_MS,
  COPY_LABEL,
  DOWNLOAD_LABEL,
  FIELD_ERRORS,
  FIELD_PLACEHOLDER,
  FILTER_BUTTON_LABEL,
  FILTER_MODAL_TITLE,
  FILTER_STEPS,
  FOLDER_PATH,
  filterLead,
  filterStateLine,
} from './filter-copy';
import {
  checkFilterName,
  GENERATED_FILE_NAME,
  readStoredFilterName,
  writeStoredFilterName,
  type FilterNameCheck,
  type FilterNameError,
} from './filter-name';
import { filterText } from './filter-text';

export interface PickUpFilterProperties {
  /** The ranking on screen, the filter's only input from the threshold (FR-35). */
  readonly ranking: PickUpInput['ranking'];
  readonly tracked: PickUpInput['tracked'];
  /** The lead's text only; it must be the value that built `ranking`. */
  readonly threshold: number;
  /** The active Craft Recipe, or `undefined` under state 43. */
  readonly recipe: { readonly id: string; readonly word: string } | undefined;
  /** The active recipe is uncostable (state 35). */
  readonly isUncostable: boolean;
}

interface FilterNameField {
  readonly text: string;
  readonly check: FilterNameCheck;
  /** State 45's error as of the last blur; an edit hides it. */
  readonly shownError: FilterNameError | undefined;
  readonly change: (text: string) => void;
  readonly blur: () => void;
}

/** DESIGN.md `filter-modal`: 480px, centred, the mark-tooltip radius and shadow, no transition. */
const MODAL_WIDTH = 480;
const MODAL_PADDING = 16;
const CLOSE_INSET = 8;

const MODAL_STYLES: ModalProps['styles'] = {
  content: {
    position: 'relative',
    background: colors.surface,
    border: `1px solid ${colors['line-strong']}`,
    borderRadius: rounded.tooltip,
    boxShadow: floatingShadows['mark-tooltip'],
    padding: px(MODAL_PADDING),
  },
  header: { position: 'static', minHeight: 0, padding: 0, marginBottom: '10px', background: 'none', transition: 'none' },
  title: { ...typeStyle('column-header'), textTransform: 'uppercase', color: colors['text-tertiary'] },
  close: { position: 'absolute', top: px(CLOSE_INSET), right: px(CLOSE_INSET) },
  body: { ...typeStyle('line-text'), lineHeight: '1.4', padding: 0, color: colors['text-secondary'] },
};

/** `{components.show-more}` accent text, as the copy and download actions take it. */
const ACTION_STYLE: CSSProperties = {
  ...typeStyle('trust'),
  padding: 0,
  border: 0,
  background: 'none',
  color: colors.accent,
  cursor: 'pointer',
};

const STEP_CONTROL: CSSProperties = { paddingTop: '8px' };

/** The field's text, read once at mount and saved on each edit that leaves a usable name (*What survives a reload*). */
function useFilterName(): FilterNameField {
  const [text, setText] = useState(() => readStoredFilterName());
  const [shownError, setShownError] = useState<FilterNameError | undefined>();
  const change = useCallback((next: string) => {
    setText(next);
    setShownError(undefined);
    if (checkFilterName(next).kind === 'usable') {
      writeStoredFilterName(next);
    }
  }, []);
  const check = useMemo(() => checkFilterName(text), [text]);
  const blur = useCallback(() => {
    setShownError(check.kind === 'unusable' ? check.error : undefined);
  }, [check]);
  return { text, check, shownError, change, blur };
}

/** Hands the text to the browser as `crafting-bases.filter` (AD-15): a `Blob` behind an `<a download>`, no request. */
function saveFilter(text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = GENERATED_FILE_NAME;
  anchor.click();
  // Some engines start the Blob download after the click returns.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}

/** `{components.filter-button}`: the sync-button look with no problem state. */
function FilterButton({ onOpen }: { readonly onOpen: () => void }): JSX.Element {
  return (
    <button
      type="button"
      data-filter-button=""
      className="fg-filter-button"
      onClick={onOpen}
      style={{
        ...typeStyle('label'),
        padding: `${px(headerControls.syncPadY)} ${px(headerControls.syncPadX)}`,
        borderRadius: rounded.control,
        display: 'inline-flex',
        alignItems: 'center',
        gap: px(headerControls.openSignGap),
        whiteSpace: 'nowrap',
      }}
    >
      <span>{FILTER_BUTTON_LABEL}</span>
      <OpenSignMark />
    </button>
  );
}

/** `{components.filter-button}` and `{components.filter-modal}` (EXPERIENCE.md Interaction 9). */
export function PickUpFilter(properties: PickUpFilterProperties): JSX.Element {
  const [isOpen, setOpen] = useState(false);
  const field = useFilterName();
  const open = useCallback(() => {
    setOpen(true);
  }, []);
  const close = useCallback(() => {
    setOpen(false);
  }, []);
  return (
    <>
      <FilterButton onOpen={open} />
      <Modal
        opened={isOpen}
        onClose={close}
        title={FILTER_MODAL_TITLE}
        centered
        size={px(MODAL_WIDTH)}
        transitionProps={{ duration: 0, exitDuration: 0 }}
        overlayProps={{ color: colors.ground, backgroundOpacity: 0.7 }}
        closeButtonProps={{ size: 'sm' }}
        classNames={{ close: 'fg-filter-close' }}
        attributes={{
          content: { 'data-filter-modal': '' },
          overlay: { 'data-filter-overlay': '' },
          close: { 'data-filter-close': '' },
        }}
        styles={MODAL_STYLES}
      >
        <FilterModalBody {...properties} field={field} onDownloaded={close} />
      </Modal>
    </>
  );
}

/** Computed at render: the modal covers every dial, so the lead and the file read one ranking. */
function FilterModalBody({
  ranking,
  tracked,
  threshold,
  recipe,
  isUncostable,
  field,
  onDownloaded,
}: PickUpFilterProperties & { readonly field: FilterNameField; readonly onDownloaded: () => void }): JSX.Element {
  const fieldId = useId();
  const recipeId = recipe?.id;
  const entries = useMemo(() => pickUpPurposes({ ranking, tracked, recipeId }), [ranking, tracked, recipeId]);
  const stateLine = filterStateLine({ entryCount: entries.length, recipeWord: recipe?.word, isUncostable });
  const { check } = field;
  const download = useCallback(() => {
    if (check.kind !== 'usable') {
      return;
    }
    saveFilter(filterText(entries, check.importName));
    onDownloaded();
  }, [check, entries, onDownloaded]);
  return (
    <>
      <p data-filter-lead="" style={{ margin: '0 0 12px' }}>
        {filterLead(threshold, recipe?.word)}
      </p>
      <ol className="fg-filter-steps" style={{ margin: 0, paddingLeft: '20px' }}>
        <Step text={FILTER_STEPS[0]}>
          <FolderPath />
        </Step>
        <Step text={<label htmlFor={fieldId}>{FILTER_STEPS[1]}</label>}>
          <NameField id={fieldId} field={field} />
        </Step>
        <Step text={FILTER_STEPS[2]}>
          {stateLine === undefined ? undefined : (
            <div data-filter-state-line="" style={STEP_CONTROL}>
              {stateLine}
            </div>
          )}
          <div style={STEP_CONTROL}>
            <button
              type="button"
              data-filter-download=""
              disabled={check.kind !== 'usable'}
              onClick={download}
              style={{
                ...ACTION_STYLE,
                fontWeight: 600,
                ...(check.kind !== 'usable' && { color: colors['text-tertiary'], cursor: 'default' }),
              }}
            >
              {DOWNLOAD_LABEL}
            </button>
          </div>
        </Step>
        <Step text={FILTER_STEPS[3]} />
      </ol>
    </>
  );
}

function Step({ text, children }: { readonly text: ReactNode; readonly children?: ReactNode }): JSX.Element {
  return (
    <li data-filter-step="">
      {text}
      {children}
    </li>
  );
}

/** Step 1's path in the verbatim register, and the copy action 10px after it. */
function FolderPath(): JSX.Element {
  const clipboard = useClipboard({ timeout: COPIED_MS });
  return (
    <div style={STEP_CONTROL}>
      <span data-filter-path="" style={{ fontFamily: stacks.mono, fontSize: typeRoles['line-text'].fontSize, color: colors.text }}>
        {FOLDER_PATH}
      </span>
      <button
        type="button"
        data-filter-copy=""
        onClick={() => {
          clipboard.copy(FOLDER_PATH);
        }}
        style={{ ...ACTION_STYLE, marginLeft: '10px' }}
      >
        {clipboard.copied ? COPIED_LABEL : COPY_LABEL}
      </button>
    </div>
  );
}

/** Step 2's field, in the threshold figure box; state 45's error shows under it after a blur. */
function NameField({ id, field }: { readonly id: string; readonly field: FilterNameField }): JSX.Element {
  const error = field.shownError;
  return (
    <div style={STEP_CONTROL}>
      <input
        id={id}
        type="text"
        data-filter-name=""
        className="fg-threshold-figure fg-filter-field"
        value={field.text}
        placeholder={FIELD_PLACEHOLDER}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => {
          field.change(event.currentTarget.value);
        }}
        onBlur={field.blur}
        style={{
          ...typeStyle('line-text'),
          display: 'block',
          boxSizing: 'border-box',
          width: '100%',
          margin: 0,
          padding: `${px(headerControls.figurePadY)} ${px(headerControls.figurePadX)}`,
          borderRadius: rounded.control,
          background: colors['surface-raised'],
          color: colors.text,
          textAlign: 'left',
          ...(error !== undefined && { borderColor: colors['trust-broken'] }),
        }}
      />
      {error === undefined ? undefined : (
        <div
          data-filter-name-error={error}
          style={{ ...typeStyle('note'), color: colors['trust-broken'], paddingTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <VerdictMark verdict="broken" />
          {FIELD_ERRORS[error]}
        </div>
      )}
    </div>
  );
}
