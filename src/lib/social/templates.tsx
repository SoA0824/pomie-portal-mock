/**
 * SNS 投稿のスライドのテンプレート（satori で画像にするための JSX）。
 *
 * - photo: 背景写真（AI 生成 / 店舗写真 / アップロード）＋ 下からの濃いグラデーション ＋ 白い文字
 * - cream: クリーム地 ＋ ロゴアイコンの透かし ＋ ブラウンの文字（画像の無いスライドの既定）
 *
 * 店舗名やエリアはスライドに出さない（美容師のポータルとしての発信であって、店舗の発信ではない）。
 *
 * satori の制約: 子要素が 2 つ以上の要素には display: flex が必要。
 * 文字は 1 つの文字列にまとめて渡す（`${a} / ${b}` のように）。
 */
import type { SocialPost, SocialSlide, SocialTemplate } from "@/lib/types";
import { pomieIconDataUri } from "./brandIcon";

export const SLIDE_WIDTH = 1080;
export const SLIDE_HEIGHT = 1350;

export type SlideContext = {
  /** 左下のサイト表記（portal.pomie.jp） */
  siteLabel: string;
};

const COLORS = {
  cream: "#fdf6f0",
  peach: "#f1c7a3",
  orange: "#c97539",
  brown: "#3a1f0c",
  ink700: "#3d3d3d",
  white: "#ffffff",
};

const FONT = "Noto Sans JP";

/** public/logo/pomie-logo.svg と同じ形（色を変えられるように埋め込み） */
function Wordmark({ color, width }: { color: string; width: number }) {
  const height = (width * 28) / 146;
  return (
    <svg width={width} height={height} viewBox="0 0 146 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M131.844 27.4062V0.195801H145.642V4.62811H136.33V11.649H144.755V16.0446H136.33V22.9739H146V27.4062H131.838H131.844Z"
        fill={color}
      />
      <path fillRule="evenodd" clipRule="evenodd" d="M111.306 11.8626V0.195801H115.804V11.8626H111.306Z" fill={color} />
      <path fillRule="evenodd" clipRule="evenodd" d="M111.306 27.412V15.623H115.804V27.412H111.306Z" fill={color} />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M79.7048 26.1603H78.4179L72.2694 10.7877L69.8266 27.4119H65.251L69.6002 0H72.7222L80.0445 17.9673L88.2068 0H91.2691L95.2848 27.4119H90.6853L88.3259 10.4336L81.2062 26.1603H80.3126"
        fill={color}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M0 0V27.4119H4.4863V17.3568H4.73653C7.62611 17.3568 10.6825 17.1309 12.8452 15.5008C15.0735 13.8036 15.7884 11.6241 15.7884 8.88293C15.7884 6.30047 14.9782 3.49824 13.1372 2.03912C11.4332 0.671577 9.24071 0 6.72647 0H0ZM11.183 8.41282C11.183 9.75594 11.0817 11.3677 9.83054 12.2835C8.50788 13.2542 6.50007 13.2359 4.60546 13.2359H4.4863V4.58493C5.21912 4.5483 5.88045 4.52999 6.47028 4.52999C8.14445 4.52999 9.199 4.92072 9.98544 5.52512C10.7242 6.25163 11.0936 7.22845 11.1711 8.40673L11.183 8.41282Z"
        fill={color}
      />
      <path
        d="M34.0438 7.07044C35.6048 5.32438 37.6066 4.43914 40.1924 4.43914C42.7781 4.43914 44.7859 5.32438 46.3409 7.07044H46.3469V7.08264C47.61 8.4685 48.3845 10.123 48.6645 12.0949H53.4368C53.1151 8.99965 51.8996 6.28899 49.7608 4.04231C47.2227 1.35607 43.9935 0.00683594 40.1864 0.00683594C36.3793 0.00683594 33.1501 1.34997 30.6061 4.04231C28.4851 6.28899 27.2816 8.99965 26.9658 12.0949H31.7321C32.0062 10.123 32.7748 8.4624 34.0259 7.07655L34.0438 7.07044Z"
        fill={color}
      />
      <path
        d="M46.359 20.5253V20.5314C44.798 22.2775 42.7664 23.1627 40.2104 23.1627C37.6545 23.1627 35.6407 22.2836 34.0559 20.5253C32.9418 19.2738 32.2149 17.8146 31.8694 16.1113H27.0732C27.4843 18.9441 28.658 21.4411 30.6301 23.5473C33.1682 26.2397 36.3974 27.5889 40.2104 27.5889C44.0235 27.5889 47.2527 26.2458 49.7907 23.5534C51.7807 21.4472 52.9663 18.9441 53.3833 16.1113H48.5813C48.2357 17.8085 47.4969 19.2738 46.3709 20.5192L46.359 20.5253Z"
        fill={color}
      />
    </svg>
  );
}

/** ロゴアイコン（丸いマーク） */
function Icon({ color, size, opacity = 1 }: { color: string; size: number; opacity?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={pomieIconDataUri(color)} width={size} height={size} alt="" style={{ width: size, height: size, opacity }} />;
}

/**
 * 見出しの文字サイズ。長い見出しは少し小さくして、変な位置で折り返しにくくする。
 * 見出しに改行を入れると、その位置で折り返す（whiteSpace: pre-wrap）。
 */
function headlineSize(headline: string, isCover: boolean): number {
  const longest = Math.max(...headline.split("\n").map((l) => l.length), 1);
  const base = isCover ? 78 : 64;
  if (longest <= 12) return base;
  if (longest <= 16) return base - 8;
  if (longest <= 22) return base - 16;
  return base - 22;
}

/** スライドの見た目を決める（個別指定 > 画像が無ければ cream > 投稿の既定） */
export function resolveTemplate(post: Pick<SocialPost, "template">, slide: SocialSlide): SocialTemplate {
  if (slide.template) return slide.template;
  if (!slide.imageUrl) return "cream";
  return post.template;
}

/** 見出しの上に出す小さな文字（ポイントの番号だけ。表紙・まとめには出さない） */
export function kickerFor(post: Pick<SocialPost, "slides">, index: number): string {
  const slide = post.slides[index];
  if (!slide || slide.kind !== "point") return "";
  const n = post.slides.slice(0, index + 1).filter((s) => s.kind === "point").length;
  return `POINT ${String(n).padStart(2, "0")}`;
}

/** フォントの部分取得のため、スライドに出るすべての文字を集める */
export function collectSlideText(post: Pick<SocialPost, "slides">, index: number, ctx: SlideContext): string {
  const slide = post.slides[index];
  if (!slide) return "";
  return [slide.headline, slide.body, kickerFor(post, index), ctx.siteLabel, `${index + 1} / ${post.slides.length}`, "POINT0123456789"].join("");
}

type Props = {
  post: SocialPost;
  index: number;
  ctx: SlideContext;
  /** 1 = 1080×1350。プレビューは 0.5 など */
  scale: number;
  /** 解決済み（絶対 URL）の背景画像。無ければ null */
  imageUrl: string | null;
};

export function createSlideElement(props: Props) {
  const slide = props.post.slides[props.index];
  const template = resolveTemplate(props.post, slide);
  return template === "photo" && props.imageUrl ? <PhotoSlide {...props} slide={slide} /> : <CreamSlide {...props} slide={slide} />;
}

function Header({ color, s, showIcon = true }: { color: string; s: number; showIcon?: boolean }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 60 * s,
        left: 72 * s,
        width: SLIDE_WIDTH * s - 144 * s,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <Wordmark color={color} width={168 * s} />
      {showIcon ? <Icon color={color} size={60 * s} /> : <div style={{ display: "flex" }} />}
    </div>
  );
}

function Footer({ color, s, ctx, index, total }: { color: string; s: number; ctx: SlideContext; index: number; total: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 72 * s,
        width: SLIDE_WIDTH * s - 144 * s,
        bottom: 60 * s,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        color,
        fontSize: 22 * s,
        letterSpacing: 1 * s,
      }}
    >
      <div style={{ display: "flex" }}>{ctx.siteLabel}</div>
      <div style={{ display: "flex" }}>{`${index + 1} / ${total}`}</div>
    </div>
  );
}

function PhotoSlide({ post, index, ctx, scale: s, imageUrl, slide }: Props & { slide: SocialSlide }) {
  const W = SLIDE_WIDTH * s;
  const H = SLIDE_HEIGHT * s;
  const isCover = slide.kind === "cover";
  const kicker = kickerFor(post, index);
  return (
    <div style={{ width: W, height: H, display: "flex", flexDirection: "column", position: "relative", backgroundColor: COLORS.brown, fontFamily: FONT }}>
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} width={W} height={H} alt="" style={{ position: "absolute", top: 0, left: 0, width: W, height: H, objectFit: "cover" }} />
      )}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: W,
          height: H,
          display: "flex",
          backgroundImage: "linear-gradient(to top, rgba(26,15,6,0.92) 0%, rgba(26,15,6,0.60) 38%, rgba(26,15,6,0.18) 70%, rgba(26,15,6,0.10) 100%)",
        }}
      />
      <Header color={COLORS.white} s={s} />
      <div style={{ position: "absolute", left: 72 * s, width: W - 144 * s, bottom: 160 * s, display: "flex", flexDirection: "column" }}>
        {kicker && <div style={{ display: "flex", color: COLORS.peach, fontSize: 26 * s, fontWeight: 700, letterSpacing: 4 * s }}>{kicker}</div>}
        <div
          style={{
            display: "flex",
            marginTop: kicker ? 20 * s : 0,
            color: COLORS.white,
            fontSize: headlineSize(slide.headline, isCover) * s,
            fontWeight: 700,
            lineHeight: 1.28,
            whiteSpace: "pre-wrap",
          }}
        >
          {slide.headline}
        </div>
        {slide.body && (
          <div style={{ display: "flex", marginTop: 30 * s, color: "rgba(255,255,255,0.90)", fontSize: 33 * s, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{slide.body}</div>
        )}
      </div>
      <Footer color="rgba(255,255,255,0.75)" s={s} ctx={ctx} index={index} total={post.slides.length} />
    </div>
  );
}

function CreamSlide({ post, index, ctx, scale: s, imageUrl, slide }: Props & { slide: SocialSlide }) {
  const W = SLIDE_WIDTH * s;
  const H = SLIDE_HEIGHT * s;
  const isCover = slide.kind === "cover";
  const isCta = slide.kind === "cta" && !imageUrl;
  const kicker = kickerFor(post, index);
  const imageTop = 190 * s;
  const imageHeight = 480 * s;
  const contentTop = imageUrl ? imageTop + imageHeight + 64 * s : 190 * s;
  return (
    <div
      style={{
        width: W,
        height: H,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        backgroundColor: COLORS.cream,
        fontFamily: FONT,
        overflow: "hidden",
      }}
    >
      {/* ロゴアイコンの透かし（右下に大きく、はみ出させる） */}
      {!isCta && (
        <div style={{ position: "absolute", right: -300 * s, bottom: -260 * s, display: "flex" }}>
          <Icon color={COLORS.orange} size={980 * s} opacity={0.08} />
        </div>
      )}
      {/* 細い枠 */}
      <div
        style={{
          position: "absolute",
          top: 36 * s,
          left: 36 * s,
          width: W - 72 * s,
          height: H - 72 * s,
          border: `${1.5 * s}px solid ${COLORS.peach}`,
          display: "flex",
        }}
      />
      <Header color={COLORS.brown} s={s} showIcon={!isCta} />
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          width={W - 144 * s}
          height={imageHeight}
          alt=""
          style={{ position: "absolute", left: 72 * s, top: imageTop, width: W - 144 * s, height: imageHeight, objectFit: "cover", borderRadius: 8 * s }}
        />
      )}
      {isCta ? (
        <div
          style={{
            position: "absolute",
            left: 72 * s,
            top: 190 * s,
            width: W - 144 * s,
            height: H - 190 * s - 160 * s,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
          }}
        >
          <Icon color={COLORS.brown} size={220 * s} />
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginTop: 56 * s,
              color: COLORS.brown,
              fontSize: (headlineSize(slide.headline, false) - 6) * s,
              fontWeight: 700,
              lineHeight: 1.35,
              whiteSpace: "pre-wrap",
            }}
          >
            {slide.headline}
          </div>
          {slide.body && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: 28 * s, color: COLORS.ink700, fontSize: 30 * s, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
              {slide.body}
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            position: "absolute",
            left: 72 * s,
            top: contentTop,
            width: W - 144 * s,
            height: H - contentTop - 160 * s,
            display: "flex",
            flexDirection: "column",
            justifyContent: imageUrl ? "flex-start" : "center",
          }}
        >
          {kicker ? (
            <div style={{ display: "flex", color: COLORS.orange, fontSize: 26 * s, fontWeight: 700, letterSpacing: 4 * s }}>{kicker}</div>
          ) : (
            <div style={{ display: "flex", width: 56 * s, height: 3 * s, backgroundColor: COLORS.orange }} />
          )}
          <div
            style={{
              display: "flex",
              marginTop: 24 * s,
              color: COLORS.brown,
              fontSize: (headlineSize(slide.headline, isCover) - 4) * s,
              fontWeight: 700,
              lineHeight: 1.32,
              whiteSpace: "pre-wrap",
            }}
          >
            {slide.headline}
          </div>
          {slide.body && <div style={{ display: "flex", marginTop: 30 * s, color: COLORS.ink700, fontSize: 32 * s, lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{slide.body}</div>}
        </div>
      )}
      <Footer color="rgba(58,31,12,0.65)" s={s} ctx={ctx} index={index} total={post.slides.length} />
    </div>
  );
}
