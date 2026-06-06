import type { CSSProperties, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;
type SpriteRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const toolbarSprite = "assets/sketchforge/toolbar-sprite.svg?v=2";
const vectorToolbarSprite = "assets/sketchforge/vector-toolbar-icons.svg?v=1";

function ToolbarSpriteIcon({ rect, className, style }: IconProps & { rect: SpriteRect }) {
  const size = 35;
  const scale = size / rect.height;

  return (
    <span
      aria-hidden="true"
      className={["toolbar-sprite-icon", className].filter(Boolean).join(" ")}
      style={
        {
          "--sprite-x": `${-rect.x * scale}px`,
          "--sprite-y": `${-rect.y * scale}px`,
          "--sprite-width": `${260 * scale}px`,
          "--sprite-height": `${80 * scale}px`,
          width: `${rect.width * scale}px`,
          height: `${size}px`,
          backgroundImage: `url(${toolbarSprite})`,
          ...(style as CSSProperties),
        } as CSSProperties
      }
    />
  );
}

function VectorToolbarSpriteIcon({ rect, className, style }: IconProps & { rect: SpriteRect }) {
  const size = 35;
  const scale = size / rect.height;

  return (
    <span
      aria-hidden="true"
      className={["vector-toolbar-sprite-icon", className].filter(Boolean).join(" ")}
      style={
        {
          "--vector-sprite-x": `${-rect.x * scale}px`,
          "--vector-sprite-y": `${-rect.y * scale}px`,
          "--vector-sprite-width": `${165 * scale}px`,
          "--vector-sprite-height": `${27 * scale}px`,
          width: `${rect.width * scale}px`,
          height: `${size}px`,
          backgroundImage: `url(${vectorToolbarSprite})`,
          ...(style as CSSProperties),
        } as CSSProperties
      }
    />
  );
}

export function GridModeIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" {...props}>
      <g fill="currentColor">
        {[7, 20, 33].map((x) =>
          [7, 20, 33].map((y) => <rect key={`${x}-${y}`} x={x} y={y} width="10" height="10" />),
        )}
      </g>
    </svg>
  );
}

export function PickaxeModeIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" {...props}>
      <path d="M12 13c9-5 20-4 29 4l-5 5c-6-5-13-7-21-4z" fill="currentColor" />
      <path d="m27 23 10 10c1.5 1.5 1.5 4 0 5.5s-4 1.5-5.5 0l-10-10z" fill="currentColor" />
      <path d="m17 27 4-4 4 4-4 4z" fill="currentColor" opacity=".82" />
    </svg>
  );
}

export function SimLabIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" {...props}>
      <path
        d="M17 22V11a3 3 0 0 1 6 0v10M23 20V9a3 3 0 0 1 6 0v12M29 21v-8a3 3 0 0 1 6 0v13M17 23l-3-3a3 3 0 0 0-4 4l10 13c2 3 5 4 9 4h2c7 0 11-5 11-12v-8"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M36 8c2 1 4 3 5 5M39 4c3 2 5 5 6 9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function BlocksModeIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" {...props}>
      <path d="M12 17h24v20H12z" fill="currentColor" />
      <path d="M17 11h14v6H17z" fill="currentColor" opacity=".92" />
      <path d="M16 21h16v4H16zM16 29h16v4H16z" fill="white" opacity=".22" />
    </svg>
  );
}

export function WorkplaneToolIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 55 55" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        d="m3.4 7.1 42.5-3.3-0.5 46.3-39.8-3.3-2.2-39.7zm8.2 38.4-0.2-5.4-4.4-0.2 0.3 5.3 4.3 0.3zm-0.2-6.1-0.1-4.9-4.5-0.1 0.2 4.7 4.4 0.3zm-0.2-5.6-0.1-4.9-4.5-0.1 0.2 5h4.4zm-0.2-5.8-0.1-5.6-4.6 0.1 0.3 5.4 4.4 0.1zm-0.2-6.2-0.1-6.1-4.8 0.3 0.4 6 4.5-0.2zm-0.1-6.7-0.2-6.5-4.9 0.4 0.3 6.4 4.8-0.3zm5.8 30.8-0.1-5.4-4.3-0.3 0.2 5.3 4.2 0.4zm-0.1-6.1v-4.9l-4.5-0.2 0.2 4.9 4.3 0.2zm-0.1-5.6v-5.2l-4.6-0.1 0.2 5.1 4.4 0.2zm0-6.2v-5.8l-4.7 0.2 0.1 5.5 4.6 0.1zm0-6.3-0.1-6.4-4.8 0.3 0.2 6.3 4.7-0.2zm-0.1-7-0.1-6.6-4.9 0.4 0.2 6.5 4.8-0.3zm6.7 31.7-0.1-5.4-5.4-0.3 0.2 5.3 5.3 0.4zm-0.2-6.1-0.1-5.4-5.2-0.1v5.1l5.3 0.4zm-0.1-6.1v-5.1l-5.3-0.1v5.1l5.3 0.1zm-0.1-6.2v-6l-5.6 0.1 0.1 5.8 5.5 0.1zm-0.1-6.6-0.1-6.5-5.4 0.3 0.1 6.4 5.4-0.2zm-0.2-7.2-0.1-6.5-5.3 0.4 0.1 6.4 5.3-0.3zm7.4 32.7v-5.6l-5.7-0.3 0.1 5.5 5.6 0.4zm-0.1-6.2v-5.4l-5.7-0.3 0.1 5.3 5.6 0.4zm0-6v-5.8h-5.8l0.1 5.5 5.7 0.3zm-0.1-6.7v-6.3l-5.8 0.2 0.1 6 5.7 0.1zm-0.1-6.8v-6.8l-5.8 0.3 0.1 6.7 5.7-0.2zm0-7.4v-6.7l-5.9 0.4 0.1 6.7 5.8-0.4zm7.2 33.7v-5.8l-6.2-0.3v5.6l6.2 0.5zm0-6.4v-5.7l-6.2-0.1v5.5l6.2 0.3zm0-6.3v-5.8l-6.2-0.1v5.8l6.2 0.1zm0-6.8v-6.5l-6.4 0.1v6.3l6.4 0.1zm0-7v-7.1l-6.6 0.4v6.9l6.6-0.2zm0-7.7v-6.7l-6.7 0.4 0.1 6.7 6.6-0.4zm7.1 34.6v-5.7l-6.4-0.4v5.7l6.4 0.4zm0-6.3v-5.9l-6.4-0.2v5.8l6.4 0.3zm0.1-6.5v-5.9l-6.5-0.1v5.8l6.5 0.2zm0.1-6.9v-6.8l-6.6 0.2v6.4l6.6 0.2zm0-7.3 0.1-7.5-6.7 0.4v7.3l6.6-0.2zm0.1-8.2v-6.7l-6.7 0.4v6.8l6.7-0.5z"
      />
    </svg>
  );
}

export function RulerToolIcon(props: IconProps) {
  return (
    <svg viewBox="98 0 60 55" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        d="m104.8 7.1 11.4-0.5 2.1 30 32.2 1.4-0.4 12.8-42.4-3.5-2.9-40.2zm43.1 41.6 0.3-8.7-6.9-0.4v3.5h-1.4v-3.6l-7.1-0.3v5.5l-1.2-0.1v-5.5l-6.9-0.3v3.6h-1.3v-3.7l-5.7-0.3 0.2 5.3h-1.3l-0.2-5.5-4.8-0.1v-1.3l4.6 0.1-0.5-6.8-3.1 0.1v-1.2l3.1-0.1-0.4-6.4-4.9 0.2-0.1-1.2 4.9-0.2-0.5-5.4h-3.2v-1.4h3.1l-0.4-5.8-7.2 0.2 2.7 36.6 38.2 3.2z"
      />
    </svg>
  );
}

export function NotesToolIcon(props: IconProps) {
  return (
    <svg viewBox="206 0 44 55" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        d="m228.3 50.6c-1.2 0.8-2.9 0.5-3.3-0.3l-3.3-6.3-0.1-0.1v-0.1l-0.1-0.1v-0.1l-1-2-3.4-0.4c-3-0.1-5.1-2.2-5.1-5.2l-0.5-24.3c0-3 2.4-5.4 5.4-5.6l23.6-1.1c3.2-0.1 5.7 2.3 5.6 5.4l-1.4 27.3c-0.1 3-2.7 5.3-5.6 5l-4.1-0.3-4.6 6.3v0.1h-0.1v0.1l-0.1 0.1-0.9 1.1c-0.2 0.3-0.6 0.3-1 0.5zm0.1-3.6 5.8-7.6 5.1 0.7c1.8 0.2 3.4-1.2 3.5-3.1l1.4-26.7c0.1-2-1.5-3.6-3.6-3.5l-22.9 1.2c-2 0.1-3.5 1.6-3.5 3.5l0.4 23.7c0 1.8 1.4 3.3 3.1 3.4l5.4 0.5 2 4.1v0.1l0.1 0.1v0.1l2.9 5.3 0.3-0.1v-1.7zm-5.8-29.5 13.3-0.2c1 0 1-1.7 0-1.7l-13.3 0.4c-1 0-1 1.6 0 1.5zm0 4.7h12.5c1.1 0 1.1-1.6 0-1.6h-12.5c-1.1 0-1.1 1.6 0 1.6zm0 4.6 13.3 0.5c1.1 0 1.1-1.6 0-1.6l-13.3-0.5c-1.1-0.1-1.1 1.6 0 1.6zm-0.2 4.7 9.1 0.5c1.1 0 1.1-1.6 0-1.7l-9.1-0.5c-1.1 0-1.1 1.7 0 1.7z"
      />
    </svg>
  );
}

export function ToolbarCopyIcon(props: IconProps) {
  return <ToolbarSpriteIcon rect={{ x: 0, y: 6.7, width: 26.1, height: 33.3 }} {...props} />;
}

export function ToolbarPasteIcon(props: IconProps) {
  return <ToolbarSpriteIcon rect={{ x: 33.5, y: 6.7, width: 22.9, height: 33.3 }} {...props} />;
}

export function ToolbarDuplicateIcon(props: IconProps) {
  return <ToolbarSpriteIcon rect={{ x: 65, y: 6.7, width: 27.5, height: 33.3 }} {...props} />;
}

export function ToolbarTrashIcon(props: IconProps) {
  return <ToolbarSpriteIcon rect={{ x: 134.2, y: 6.7, width: 21.1, height: 33.3 }} {...props} />;
}

export function ToolbarUndoIcon(props: IconProps) {
  return <ToolbarSpriteIcon rect={{ x: 162.9, y: 8, width: 31, height: 30.6 }} {...props} />;
}

export function ToolbarRedoIcon(props: IconProps) {
  return <ToolbarSpriteIcon rect={{ x: 196.5, y: 8, width: 31.2, height: 30.6 }} {...props} />;
}

export function ToolbarLightbulbIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" {...props}>
      <path
        d="M17 37h14M19 42h10M16 23c0-5.1 3.8-9 8-9s8 3.9 8 9c0 3.1-1.4 5.3-3.6 7.4-.9.9-1.4 2-1.4 3.3v.3h-6v-.3c0-1.3-.5-2.4-1.4-3.3C17.4 28.3 16 26.1 16 23Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M24 7v3M11 14l2.4 2M37 14l-2.4 2" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

export function ToolbarImportIcon(props: IconProps) {
  return <VectorToolbarSpriteIcon rect={{ x: 0, y: 0, width: 24, height: 27 }} {...props} />;
}

export function ToolbarVectorExportIcon(props: IconProps) {
  return <VectorToolbarSpriteIcon rect={{ x: 34, y: 0, width: 25, height: 27 }} {...props} />;
}

export function ToolbarSettingsIcon(props: IconProps) {
  return <VectorToolbarSpriteIcon rect={{ x: 66, y: 0, width: 30, height: 27 }} {...props} />;
}

export function ToolbarShapeAddIcon(props: IconProps) {
  return <VectorToolbarSpriteIcon rect={{ x: 104, y: 0, width: 29, height: 27 }} {...props} />;
}

export function ToolbarHideSelectedIcon(props: IconProps) {
  return <VectorToolbarSpriteIcon rect={{ x: 138, y: 0, width: 27, height: 27 }} {...props} />;
}

export function ToolbarHoleIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" {...props}>
      <circle cx="24" cy="24" r="13" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="7 5" />
    </svg>
  );
}

export function ToolbarCaretDownIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" {...props}>
      <path d="m16 19 8 9 8-9z" fill="currentColor" />
    </svg>
  );
}

export function ToolbarGroupIcon(props: IconProps) {
  return <ToolbarSpriteIcon rect={{ x: 30.3, y: 46.7, width: 29.1, height: 32.5 }} {...props} />;
}

export function ToolbarUngroupIcon(props: IconProps) {
  return <ToolbarSpriteIcon rect={{ x: 65.4, y: 46.7, width: 26.5, height: 32.5 }} {...props} />;
}

export function ToolbarAlignIcon(props: IconProps) {
  return <ToolbarSpriteIcon rect={{ x: 97.3, y: 46.7, width: 29.1, height: 32.5 }} {...props} />;
}

export function ToolbarMirrorIcon(props: IconProps) {
  return <ToolbarSpriteIcon rect={{ x: 131.4, y: 46.7, width: 27, height: 32.5 }} {...props} />;
}

export function ToolbarMagnetIcon(props: IconProps) {
  return <ToolbarSpriteIcon rect={{ x: 167.8, y: 46.7, width: 20.8, height: 32.5 }} {...props} />;
}

export function ToolbarPaintIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" {...props}>
      <path d="m13 28 16-16 8 8-16 16H13z" fill="currentColor" opacity=".2" />
      <path d="m13 28 16-16 8 8-16 16H13zM27 14l7 7M13 36h8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M36 31c3 4 4 6 4 8a4 4 0 0 1-8 0c0-2 1-4 4-8Z" fill="currentColor" />
    </svg>
  );
}

export function ToolbarExportIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" {...props}>
      <path d="M10 31h28v9H10z" fill="currentColor" opacity=".18" />
      <path d="M10 31h28v9H10zM24 8v21M16 21l8 8 8-8M15 35v5M33 35v5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ToolbarSendBackwardIcon(props: IconProps) {
  return <ToolbarSpriteIcon rect={{ x: 198.3, y: 46.7, width: 27.4, height: 32.5 }} {...props} />;
}

export function ToolbarBringForwardIcon(props: IconProps) {
  return <ToolbarSpriteIcon rect={{ x: 231.5, y: 46.7, width: 25.7, height: 32.3 }} {...props} />;
}
