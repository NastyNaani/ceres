import React from 'react';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { colors } from '../theme';

export type IconName =
  | 'scan'
  | 'create'
  | 'history'
  | 'flash'
  | 'flashOff'
  | 'flip'
  | 'copy'
  | 'share'
  | 'external'
  | 'close'
  | 'check'
  | 'link'
  | 'text'
  | 'mail'
  | 'phone'
  | 'wifi'
  | 'trash'
  | 'chevron'
  | 'download'
  | 'sparkle'
  | 'image'
  | 'settings'
  | 'star'
  | 'starFilled'
  | 'search'
  | 'message'
  | 'location'
  | 'user'
  | 'calendar'
  | 'shield'
  | 'barcode'
  | 'lock'
  | 'tag'
  | 'plus'
  | 'minus';

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export function Icon({ name, size = 24, color = colors.silver, strokeWidth = 1.8 }: Props) {
  const common = {
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'scan' && (
        <>
          <Path d="M4 8V6a2 2 0 0 1 2-2h2" {...common} />
          <Path d="M16 4h2a2 2 0 0 1 2 2v2" {...common} />
          <Path d="M20 16v2a2 2 0 0 1-2 2h-2" {...common} />
          <Path d="M8 20H6a2 2 0 0 1-2-2v-2" {...common} />
          <Line x1="4" y1="12" x2="20" y2="12" {...common} />
        </>
      )}
      {name === 'create' && (
        <>
          <Rect x="3.5" y="3.5" width="7" height="7" rx="1.6" {...common} />
          <Rect x="3.5" y="13.5" width="7" height="7" rx="1.6" {...common} />
          <Path d="M14.5 14v6.5M14.5 20.5H21M21 14v6.5M14.5 3.5h6.5v6.5h-6.5z" {...common} />
        </>
      )}
      {name === 'history' && (
        <>
          <Circle cx="12" cy="12" r="8.5" {...common} />
          <Path d="M12 7.5V12l3 1.8" {...common} />
        </>
      )}
      {name === 'flash' && (
        <Path d="M13 2 4.5 13.2c-.3.4 0 1 .5 1H11l-1 7.8 8.5-11.2c.3-.4 0-1-.5-1H12z" {...common} />
      )}
      {name === 'flashOff' && (
        <>
          <Path d="M9.4 5.8 13 2l-.7 5.4M11 13.5 5 14c-.5 0-.8-.6-.5-1L7 9.8" {...common} />
          <Path d="M18 9.5 10 20l.6-4.7" {...common} />
          <Line x1="3" y1="3" x2="21" y2="21" {...common} />
        </>
      )}
      {name === 'flip' && (
        <>
          <Path d="M3 8a9 9 0 0 1 15-3l2 2" {...common} />
          <Path d="M21 16a9 9 0 0 1-15 3l-2-2" {...common} />
          <Path d="M20 3v4h-4M4 21v-4h4" {...common} />
        </>
      )}
      {name === 'copy' && (
        <>
          <Rect x="8.5" y="8.5" width="11" height="11" rx="2.4" {...common} />
          <Path d="M5.5 15.5H5a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 5 3.5h9A1.5 1.5 0 0 1 15.5 5v.5" {...common} />
        </>
      )}
      {name === 'share' && (
        <>
          <Path d="M12 15V3.5M8.5 7 12 3.5 15.5 7" {...common} />
          <Path d="M6 11.5H5.5A1.5 1.5 0 0 0 4 13v6.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V13a1.5 1.5 0 0 0-1.5-1.5H18" {...common} />
        </>
      )}
      {name === 'external' && (
        <>
          <Path d="M14 4h6v6M20 4l-9 9" {...common} />
          <Path d="M18 13.5V19a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 19V8a1.5 1.5 0 0 1 1.5-1.5H11" {...common} />
        </>
      )}
      {name === 'close' && (
        <>
          <Line x1="5.5" y1="5.5" x2="18.5" y2="18.5" {...common} />
          <Line x1="18.5" y1="5.5" x2="5.5" y2="18.5" {...common} />
        </>
      )}
      {name === 'check' && <Path d="m4.5 12.5 5 5 10-11" {...common} />}
      {name === 'link' && (
        <>
          <Path d="M10 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1.5 1.5" {...common} />
          <Path d="M14 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5L12.5 17" {...common} />
        </>
      )}
      {name === 'text' && (
        <>
          <Path d="M5 6h14M5 6V4.5M19 6V4.5M12 6v14M9.5 20h5" {...common} />
        </>
      )}
      {name === 'mail' && (
        <>
          <Rect x="3.5" y="5.5" width="17" height="13" rx="2.2" {...common} />
          <Path d="m4.5 7 7.5 6 7.5-6" {...common} />
        </>
      )}
      {name === 'phone' && (
        <Path
          d="M6.5 3.5h2.4l1.4 4-2 1.4a11 11 0 0 0 5 5l1.4-2 4 1.4v2.4a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2z"
          {...common}
        />
      )}
      {name === 'wifi' && (
        <>
          <Path d="M2.5 9a14 14 0 0 1 19 0" {...common} />
          <Path d="M6 12.5a9 9 0 0 1 12 0" {...common} />
          <Path d="M9.2 16a4.5 4.5 0 0 1 5.6 0" {...common} />
          <Circle cx="12" cy="19.5" r="0.6" fill={color} stroke={color} />
        </>
      )}
      {name === 'trash' && (
        <>
          <Path d="M4.5 6.5h15M9 6.5V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v1.5" {...common} />
          <Path d="M6.5 6.5 7.3 19a1.6 1.6 0 0 0 1.6 1.5h6.2a1.6 1.6 0 0 0 1.6-1.5l.8-12.5" {...common} />
          <Line x1="10" y1="10" x2="10.3" y2="17" {...common} />
          <Line x1="14" y1="10" x2="13.7" y2="17" {...common} />
        </>
      )}
      {name === 'chevron' && <Path d="m9 6 6 6-6 6" {...common} />}
      {name === 'download' && (
        <>
          <Path d="M12 3.5v11M8 11l4 4 4-4" {...common} />
          <Path d="M4.5 16.5v2A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5v-2" {...common} />
        </>
      )}
      {name === 'sparkle' && (
        <Path
          d="M12 3c.4 3.8 1.2 4.6 5 5-3.8.4-4.6 1.2-5 5-.4-3.8-1.2-4.6-5-5 3.8-.4 4.6-1.2 5-5z"
          {...common}
        />
      )}
      {name === 'image' && (
        <>
          <Rect x="3.5" y="4.5" width="17" height="15" rx="2.4" {...common} />
          <Circle cx="8.5" cy="9.5" r="1.6" {...common} />
          <Path d="m5 17 4.5-4.5 3 3L16 11l3.5 3.5" {...common} />
        </>
      )}
      {name === 'settings' && (
        <>
          <Circle cx="12" cy="12" r="3.2" {...common} />
          <Path
            d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6M18.7 18.7l-1.6-1.6M6.9 6.9 5.3 5.3"
            {...common}
          />
        </>
      )}
      {name === 'star' && (
        <Path
          d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"
          {...common}
        />
      )}
      {name === 'starFilled' && (
        <Path
          d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"
          fill={color}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
        />
      )}
      {name === 'search' && (
        <>
          <Circle cx="10.5" cy="10.5" r="6.5" {...common} />
          <Line x1="15.5" y1="15.5" x2="20" y2="20" {...common} />
        </>
      )}
      {name === 'message' && (
        <Path
          d="M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H9l-4 3.5V16.5H4A1.5 1.5 0 0 1 2.5 15V7A1.5 1.5 0 0 1 4 5.5z"
          {...common}
        />
      )}
      {name === 'location' && (
        <>
          <Path d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11z" {...common} />
          <Circle cx="12" cy="10" r="2.6" {...common} />
        </>
      )}
      {name === 'user' && (
        <>
          <Circle cx="12" cy="8" r="3.6" {...common} />
          <Path d="M4.5 20a7.5 7.5 0 0 1 15 0" {...common} />
        </>
      )}
      {name === 'calendar' && (
        <>
          <Rect x="3.5" y="5" width="17" height="15.5" rx="2.4" {...common} />
          <Path d="M3.5 9.5h17M8 3.2v3.4M16 3.2v3.4" {...common} />
        </>
      )}
      {name === 'shield' && (
        <Path
          d="M12 3l7 2.6v5.2c0 4.6-3 8.2-7 9.7-4-1.5-7-5.1-7-9.7V5.6L12 3z"
          {...common}
        />
      )}
      {name === 'barcode' && (
        <Path
          d="M4 6v12M7 6v12M10 6v9M13 6v12M16 6v9M20 6v12"
          {...common}
        />
      )}
      {name === 'lock' && (
        <>
          <Rect x="5" y="11" width="14" height="10" rx="2.2" {...common} />
          <Path d="M8 11V8a4 4 0 0 1 8 0v3" {...common} />
        </>
      )}
      {name === 'tag' && (
        <>
          <Path d="M3.5 12.5 12.5 3.5h7v7L10.5 20.5z" {...common} />
          <Circle cx="16.2" cy="7.8" r="1.2" fill={color} stroke={color} />
        </>
      )}
      {name === 'plus' && (
        <>
          <Line x1="12" y1="5" x2="12" y2="19" {...common} />
          <Line x1="5" y1="12" x2="19" y2="12" {...common} />
        </>
      )}
      {name === 'minus' && <Line x1="5" y1="12" x2="19" y2="12" {...common} />}
    </Svg>
  );
}
