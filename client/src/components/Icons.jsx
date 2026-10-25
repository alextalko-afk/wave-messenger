// Wave's own icon set: solid glyphs, with rounded strokes for simple marks.
// Every icon takes `size` and passes the rest (className, style…) to the <svg>;
// colour comes from `currentColor`.

const FILL = { fill: 'currentColor', stroke: 'none' };
const EVEN_ODD = { ...FILL, fillRule: 'evenodd' };

function icon(defaultSize, children) {
  return function WaveIcon({ size, ...rest }) {
    const s = size || defaultSize;
    return (
      <svg
        viewBox="0 0 24 24"
        width={s}
        height={s}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...rest}
      >
        {children}
      </svg>
    );
  };
}

const circle = (cx, cy, r) => `M${cx - r},${cy}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0z`;
const rrect = (x, y, w, h, r) =>
  `M${x + r},${y}h${w - 2 * r}a${r},${r} 0 0 1 ${r},${r}v${h - 2 * r}a${r},${r} 0 0 1 ${-r},${r}` +
  `h${-(w - 2 * r)}a${r},${r} 0 0 1 ${-r},${-r}v${-(h - 2 * r)}a${r},${r} 0 0 1 ${r},${-r}z`;

const HANDSET =
  'M6.2 2.8c.6-.5 1.5-.4 2 .2l2 2.5c.4.5.4 1.2 0 1.7l-1.2 1.4c-.2.2-.2.5 0 .8 1 1.9 2.7 3.6 4.7 4.7.3.1.6.1.8-.1' +
  'l1.4-1.2c.5-.4 1.2-.4 1.7 0l2.5 2c.6.5.7 1.4.2 2l-1.4 1.8c-.9 1.1-2.4 1.6-3.8 1.2C10.3 18.5 5.5 13.7 3.5 7.4' +
  'c-.4-1.4.1-2.9 1.2-3.8z';
const BUBBLE =
  'M12 2.8c-5.2 0-9.2 3.6-9.2 8.3 0 2.4 1 4.5 2.8 6-.2 1.5-.8 2.7-1.8 3.7a.6.6 0 00.5 1c2.1-.1 3.9-.8 5.3-1.9' +
  '.8.2 1.6.3 2.4.3 5.2 0 9.2-3.6 9.2-8.3S17.2 2.8 12 2.8z';
const BELL =
  'M12 2.5a1.5 1.5 0 011.5 1.5v.6A6.5 6.5 0 0118.5 11v4.2l1.6 2.1c.5.6 0 1.7-.8 1.7H4.7c-.8 0-1.3-1.1-.8-1.7' +
  'l1.6-2.1V11a6.5 6.5 0 015-6.4V4A1.5 1.5 0 0112 2.5z';
const BELL_CLAPPER = 'M9.7 20.3h4.6a2.3 2.3 0 01-4.6 0z';
const VIDEO_LENS = 'M17.5 10.6l3.3-2.2c.6-.4 1.2 0 1.2.7v6.1c0 .7-.6 1.1-1.2.7l-3.3-2.2z';
const PEOPLE = (
  <>
    <circle {...FILL} cx="9" cy="8" r="3.6" />
    <path {...FILL} d="M2.5 19.5c0-3.4 2.9-5.7 6.5-5.7s6.5 2.3 6.5 5.7c0 .6-.4 1-1 1H3.5c-.6 0-1-.4-1-1z" />
    <circle {...FILL} cx="17.2" cy="9" r="2.7" />
    <path
      {...FILL}
      d="M17.2 14.2c2.5 0 4.4 1.6 4.8 4.1.1.6-.3 1.2-.9 1.2h-3.7c.2-.4.2-.8.2-1.2 0-1.6-.6-3.1-1.7-4.1.4-.1.9-.1 1.3-.1z"
    />
  </>
);

export const IconSearch = icon(
  18,
  <>
    <path d={circle(10.5, 10.5, 6.2)} strokeWidth="2.8" />
    <path d="M15.4 15.4L20 20" strokeWidth="3" />
  </>
);

export const IconPaperclip = icon(
  20,
  <path d="M20 11.5l-8 8a5 5 0 01-7-7l8.5-8.5a3.3 3.3 0 014.7 4.7L9.5 17.3a1.7 1.7 0 01-2.4-2.4L15 7" />
);

export const IconSend = icon(
  20,
  <path
    {...FILL}
    d="M3.2 11.1L19.8 3.6c.9-.4 1.8.5 1.4 1.4l-7.5 16.6c-.4.9-1.7.8-2-.1l-1.8-6.4-6.4-1.8c-.9-.3-1-1.6-.1-2z"
  />
);

export const IconEdit = icon(
  15,
  <>
    <path {...FILL} d="M15.2 4.8l4 4-10.9 10.9c-.2.2-.4.3-.7.4L4.3 20.7l.6-3.3c.1-.3.2-.5.4-.7z" />
    <path {...FILL} d="M16.6 3.4c.8-.8 2-.8 2.8 0l1.2 1.2c.8.8.8 2 0 2.8l-.7.7-4-4z" />
  </>
);

export const IconTrash = icon(
  15,
  <>
    <path {...FILL} d="M9 3.5h6l.7 1.5H20a1 1 0 010 2H4a1 1 0 010-2h4.3z" />
    <path {...FILL} d="M5.5 9h13l-.9 10.2A2 2 0 0115.6 21H8.4a2 2 0 01-2-1.8z" />
  </>
);

export const IconLogout = icon(
  17,
  <>
    <path d="M10 4H6a2 2 0 00-2 2v12a2 2 0 002 2h4" strokeWidth="2.2" />
    <path d="M15 8l4 4-4 4M19 12H9" />
  </>
);

export const IconSun = icon(
  17,
  <>
    <circle {...FILL} cx="12" cy="12" r="4.4" />
    <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4" strokeWidth="2.2" />
  </>
);

export const IconMoon = icon(17, <path {...FILL} d="M20.5 13.6A8.6 8.6 0 1110.4 3.5a7 7 0 0010.1 10.1z" />);

export const IconMic = icon(
  20,
  <>
    <rect {...FILL} x="8.5" y="2.5" width="7" height="12.5" rx="3.5" />
    <path d="M5.5 11.5a6.5 6.5 0 0013 0M12 18v3" strokeWidth="2.2" />
  </>
);

export const IconPlay = icon(
  16,
  <path {...FILL} d="M8 6.2c0-1.1 1.2-1.7 2.1-1.1l9.1 5.8c.8.5.8 1.7 0 2.2l-9.1 5.8c-.9.6-2.1 0-2.1-1.1z" />
);

export const IconPause = icon(
  16,
  <>
    <path {...FILL} d={rrect(6.5, 4.5, 3.8, 15, 1.4)} />
    <path {...FILL} d={rrect(13.7, 4.5, 3.8, 15, 1.4)} />
  </>
);

export const IconCheck = icon(15, <path d="M5 12.5l4.5 4.5L19 7.5" strokeWidth="2.8" />);
export const IconCheckAll = icon(18, <path d="M2.5 12.5l4 4 8-9M11 15.5l1.5 1.5 8.5-9.5" />);
export const IconClose = icon(14, <path d="M6 6l12 12M18 6L6 18" strokeWidth="2.6" />);

export const IconGroup = icon(18, PEOPLE);
export const IconUsers = icon(13, PEOPLE);

// The brand mark: a wave line.
export const IconChatLogo = icon(34, <path d="M3 13c2.5-4.5 4.5-4.5 7 0s4.5 4.5 7 0c1.2-2 2.2-2.6 4-2.4" strokeWidth="2.2" />);

export const IconBack = icon(22, <path d="M15 5l-7 7 7 7" strokeWidth="2.6" />);
export const IconStop = icon(16, <rect {...FILL} x="5" y="5" width="14" height="14" rx="3" />);

export const IconUser = icon(
  18,
  <>
    <circle {...FILL} cx="12" cy="8" r="4" />
    <path {...FILL} d="M4.5 20c0-3.9 3.4-6.5 7.5-6.5s7.5 2.6 7.5 6.5c0 .6-.4 1-1 1h-13c-.6 0-1-.4-1-1z" />
  </>
);

export const IconPhone = icon(18, <path {...FILL} d={HANDSET} />);

export const IconPhoneOff = icon(
  18,
  <g transform="rotate(135 12 12)">
    <path {...FILL} d={HANDSET} />
  </g>
);

export const IconVideo = icon(
  18,
  <>
    <rect {...FILL} x="2.5" y="6" width="13" height="12" rx="3.2" />
    <path {...FILL} d={VIDEO_LENS} />
  </>
);

export const IconVideoOff = icon(
  18,
  <>
    <rect {...FILL} x="2.5" y="6" width="13" height="12" rx="3.2" fillOpacity="0.45" />
    <path {...FILL} d={VIDEO_LENS} fillOpacity="0.45" />
    <path d="M4 4l16 16" />
  </>
);

export const IconMicOff = icon(
  18,
  <>
    <rect {...FILL} x="8.5" y="2.5" width="7" height="12.5" rx="3.5" fillOpacity="0.45" />
    <path d="M5.5 11.5a6.5 6.5 0 0013 0M12 18v3" strokeWidth="2.2" strokeOpacity="0.45" />
    <path d="M4 4l16 16" />
  </>
);

export const IconVolume = icon(
  18,
  <>
    <path {...FILL} d="M4 9.6c0-.6.4-1 1-1h2.6l3.7-3.1c.7-.6 1.7-.1 1.7.8v11.4c0 .9-1 1.4-1.7.8l-3.7-3.1H5c-.6 0-1-.4-1-1z" />
    <path d="M16.5 9.3a4 4 0 010 5.4M19 6.8a7.5 7.5 0 010 10.4" strokeWidth="2.2" />
  </>
);

export const IconMoreDots = icon(
  18,
  <>
    <circle {...FILL} cx="5" cy="12" r="1.8" />
    <circle {...FILL} cx="12" cy="12" r="1.8" />
    <circle {...FILL} cx="19" cy="12" r="1.8" />
  </>
);

export const IconMenu = icon(22, <path d="M4 7h16M4 12h16M4 17h16" />);

export const IconImage = icon(
  18,
  <path
    {...EVEN_ODD}
    d="M5.5 3h13A2.5 2.5 0 0121 5.5v13a2.5 2.5 0 01-2.5 2.5h-13A2.5 2.5 0 013 18.5v-13A2.5 2.5 0 015.5 3zM8.6 6.9a1.8 1.8 0 110 3.6 1.8 1.8 0 010-3.6zM5 18l4.2-5.3 3 3.6 2.2-2.6L19 18z"
  />
);

export const IconInfo = icon(
  20,
  <path
    {...EVEN_ODD}
    d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 4.6a1.3 1.3 0 110 2.6 1.3 1.3 0 010-2.6zM10.8 11h2.4v6h-2.4z"
  />
);

export const IconReply = icon(18, <path d="M9 7L4 12l5 5M4 12h10a6 6 0 016 6" />);

export const IconClock = icon(
  14,
  <>
    <circle cx="12" cy="12" r="9" strokeWidth="2.2" />
    <path d="M12 7.5V12l3 2" strokeWidth="2.2" />
  </>
);

export const IconForward =icon(18, <path d="M15 7l5 5-5 5M20 12H10a6 6 0 00-6 6" />);

export const IconPin = icon(
  16,
  <>
    <path {...FILL} d="M8 3.5h8l-1.2 6.2 2.7 2.8c.5.5.1 1.5-.6 1.5H7.1c-.7 0-1.1-1-.6-1.5l2.7-2.8z" />
    <path d="M12 14v6.5" strokeWidth="2.2" />
  </>
);

export const IconBell = icon(
  16,
  <>
    <path {...FILL} d={BELL} />
    <path {...FILL} d={BELL_CLAPPER} />
  </>
);

export const IconBellOff = icon(
  16,
  <>
    <path {...FILL} d={BELL} fillOpacity="0.45" />
    <path {...FILL} d={BELL_CLAPPER} fillOpacity="0.45" />
    <path d="M4 4l16 16" />
  </>
);

export const IconMailUnread = icon(
  16,
  <>
    <path {...EVEN_ODD} d={`${rrect(2.5, 5.5, 19, 13, 3)}M5 8.4l7 4.8 7-4.8v1.9l-7 4.8-7-4.8z`} />
    <circle {...FILL} cx="19.5" cy="5" r="3" />
  </>
);

export const IconEraser = icon(
  16,
  <>
    <path
      {...FILL}
      d="M14.2 3.8a2.2 2.2 0 013.1 0l3 3a2.2 2.2 0 010 3.1l-8.6 8.6H8.2l-4.4-4.4a2.2 2.2 0 010-3.1z"
    />
    <path d="M11 20.5h9" strokeWidth="2.2" />
  </>
);

export const IconSmile = icon(
  20,
  <path
    {...EVEN_ODD}
    d="M12 2a10 10 0 100 20 10 10 0 000-20zM8.6 8.8a1.4 1.4 0 110 2.8 1.4 1.4 0 010-2.8zm6.8 0a1.4 1.4 0 110 2.8 1.4 1.4 0 010-2.8zM7.4 13.6h9.2a4.6 4.6 0 01-9.2 0z"
  />
);

export const IconSticker = icon(
  20,
  <path
    {...EVEN_ODD}
    d="M8 3h6.5L21 9.5V16a5 5 0 01-5 5H8a5 5 0 01-5-5V8a5 5 0 015-5zM14 4.4V8a1.5 1.5 0 001.5 1.5h4.1z"
  />
);

export const IconFile = icon(
  20,
  <path
    {...EVEN_ODD}
    d="M7 2.5h6l6 6V19a2.5 2.5 0 01-2.5 2.5h-9.5A2.5 2.5 0 015 19V5A2.5 2.5 0 017 2.5zM13 4.4V8a1 1 0 001 1h3.6z"
  />
);

export const IconDownload = icon(20, <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />);

export const IconPlus = icon(20, <path d="M12 5v14M5 12h14" strokeWidth="2.6" />);

export const IconSettings = icon(
  20,
  <>
    <rect {...FILL} x="3" y="5" width="18" height="2.4" rx="1.2" />
    <rect {...FILL} x="3" y="10.8" width="18" height="2.4" rx="1.2" />
    <rect {...FILL} x="3" y="16.6" width="18" height="2.4" rx="1.2" />
    <circle {...FILL} cx="15.5" cy="6.2" r="3.2" />
    <circle {...FILL} cx="8.5" cy="12" r="3.2" />
    <circle {...FILL} cx="16" cy="17.8" r="3.2" />
  </>
);

export const IconChat = icon(
  24,
  <path
    {...EVEN_ODD}
    d={`${BUBBLE}M8 10a1.25 1.25 0 110 2.5A1.25 1.25 0 018 10zm4 0a1.25 1.25 0 110 2.5A1.25 1.25 0 0112 10zm4 0a1.25 1.25 0 110 2.5A1.25 1.25 0 0116 10z`}
  />
);

export const IconLock = icon(
  20,
  <>
    <rect {...FILL} x="4.5" y="10" width="15" height="11" rx="3" />
    <path d="M8 10V7.5a4 4 0 018 0V10" strokeWidth="2.4" />
  </>
);

export const IconPalette = icon(
  20,
  <path
    {...EVEN_ODD}
    d="M12 2.5a9.5 9.5 0 100 19c1.1 0 1.8-.8 1.8-1.7 0-.5-.2-.9-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1 .8-1.7 1.8-1.7H17a4.7 4.7 0 004.5-4.8C21.5 6.1 17.2 2.5 12 2.5zM6.9 10.6a1.4 1.4 0 110 2.8 1.4 1.4 0 010-2.8zm2.7-3.7a1.4 1.4 0 110 2.8 1.4 1.4 0 010-2.8zm4.8 0a1.4 1.4 0 110 2.8 1.4 1.4 0 010-2.8zm2.9 3.3a1.4 1.4 0 110 2.8 1.4 1.4 0 010-2.8z"
  />
);
