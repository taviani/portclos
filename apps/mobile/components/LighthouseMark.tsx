import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

type Props = {
  width?: number;
  height?: number;
  /** 0–1 opacity for the soft lantern bloom behind the tower. */
  glowOpacity?: number;
};

/** Stylized Joliguet beacon — yellow / black bands on red rock. */
export function LighthouseMark({ width = 280, height = 368, glowOpacity = 1 }: Props) {
  return (
    <Svg width={width} height={height} viewBox="0 0 320 420">
      <Defs>
        <radialGradient id="glow" cx="160" cy="78" rx="118" ry="88" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#FFE08A" stopOpacity={0.95} />
          <Stop offset="0.45" stopColor="#F5C542" stopOpacity={0.35} />
          <Stop offset="1" stopColor="#F5C542" stopOpacity={0} />
        </radialGradient>
        <linearGradient id="rock" x1="40" y1="300" x2="280" y2="400" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#8B4A32" />
          <Stop offset="1" stopColor="#5C2E1F" />
        </linearGradient>
        <linearGradient id="water" x1="160" y1="360" x2="160" y2="420" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#0B4F6C" stopOpacity={0.9} />
          <Stop offset="1" stopColor="#062C38" stopOpacity={0.2} />
        </linearGradient>
      </Defs>

      <Ellipse cx="160" cy="78" rx="118" ry="88" fill="url(#glow)" opacity={glowOpacity} />

      <Path
        d="M0 355C48 340 96 348 160 352C224 356 272 348 320 355V420H0V355Z"
        fill="url(#water)"
      />

      <Path
        d="M28 372C48 330 78 318 118 328C142 334 156 348 176 344C214 336 246 318 292 348C304 358 312 372 318 388H22C20 380 22 376 28 372Z"
        fill="url(#rock)"
      />
      <Path
        d="M62 378C78 352 104 346 128 354C146 360 158 372 180 368C210 362 236 350 268 372C278 380 284 390 286 398H58C56 390 58 382 62 378Z"
        fill="#A35A3C"
      />
      <Path
        d="M96 392C108 374 128 370 148 376C166 382 176 392 196 388C220 382 240 376 258 392H92C92 392 94 396 96 392Z"
        fill="#6E3824"
        opacity={0.85}
      />

      <Ellipse cx="168" cy="348" rx="58" ry="12" fill="#031016" opacity={0.35} />

      <G>
        <Path d="M112 318H208L202 168H118L112 318Z" fill="#C9A227" />
        <Path d="M108 348H212L208 318H112L108 348Z" fill="#9A8168" />
        <Path d="M112 336H208" stroke="#7A6550" strokeWidth={2} opacity={0.5} />
        <Path d="M114 326H206" stroke="#7A6550" strokeWidth={2} opacity={0.35} />

        <Path d="M116 288H204L202 248H118L116 288Z" fill="#F2C94C" />
        <Path d="M118 248H202L200 208H120L118 248Z" fill="#141414" />
        <SvgText
          x="160"
          y="234"
          fill="#F7F4EA"
          fontSize="15"
          fontWeight="700"
          textAnchor="middle"
          letterSpacing="1.5"
        >
          JOLIGUET
        </SvgText>

        <Path d="M120 208H200L196 128H124L120 208Z" fill="#F5D76E" />
        <Path d="M124 128H196L194 112H126L124 128Z" fill="#E8C84A" />

        <Path d="M122 112H198" stroke="#F0D060" strokeWidth={3} strokeLinecap="round" />
        <Path
          d="M128 104V112M144 104V112M160 104V112M176 104V112M192 104V112"
          stroke="#F0D060"
          strokeWidth={2}
          strokeLinecap="round"
        />

        <Path d="M132 200V130M142 200V130" stroke="#C9A227" strokeWidth={2} />
        <Path
          d="M132 140H142M132 155H142M132 170H142M132 185H142"
          stroke="#C9A227"
          strokeWidth={2}
        />

        <Rect
          x="88"
          y="148"
          width="34"
          height="22"
          rx="2"
          transform="rotate(-18 105 159)"
          fill="#1B2A34"
          stroke="#8FA3B0"
          strokeWidth={1.5}
        />

        <Rect x="142" y="78" width="36" height="34" rx="4" fill="#F2C94C" />
        <Rect x="146" y="88" width="28" height="14" rx="2" fill="#1F4A3A" />
        <Ellipse cx="160" cy="78" rx="20" ry="8" fill="#E8C84A" />
        <Path d="M160 70V58" stroke="#D8B84A" strokeWidth={2} strokeLinecap="round" />
        <Circle cx="160" cy="56" r="2.5" fill="#FFE9A8" />
        <Rect x="150" y="90" width="6" height="10" rx="1" fill="#9ED9C2" opacity={0.55} />
      </G>
    </Svg>
  );
}
