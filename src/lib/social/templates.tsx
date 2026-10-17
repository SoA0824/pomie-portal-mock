/**
 * SNS 投稿のスライドのテンプレート（satori で画像にするための JSX）。
 *
 * - photo: 背景写真（AI 生成 / 店舗写真 / アップロード）＋ 下からの濃いグラデーション ＋ 明るい文字
 * - cream: ブランド色の地 ＋ ロゴアイコンの透かし ＋ 細い枠（画像の無いスライドの既定）
 *
 * 色・フォント・ロゴはすべて brand.ts の BRAND から取る（ここにブランド固有の値を書かない）。
 * 店舗名・エリア・美容師はスライドに出さない（ポータルとしての記事紹介であって、店舗や個人の発信ではない）。
 *
 * satori の制約: 子要素が 2 つ以上の要素には display: flex が必要。
 * 文字は 1 つの文字列にまとめて渡す（`${a} / ${b}` のように）。
 */
import type { SocialPost, SocialSlide, SocialTemplate } from "@/lib/types";
import { BRAND } from "./brand";

export const SLIDE_WIDTH = 1080;
export const SLIDE_HEIGHT = 1350;

export type SlideContext = {
  /** 左下のサイト表記（portal.pomie.jp） */
  siteLabel: string;
};

const C = BRAND.colors;
const FONT = BRAND.font.family;

function Wordmark({ color, width }: { color: string; width: number }) {
  const height = width / BRAND.wordmark.aspect;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={BRAND.wordmark.dataUri(color)} width={width} height={height} alt="" style={{ width, height }} />;
}

function Icon({ color, size, opacity = 1 }: { color: string; size: number; opacity?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={BRAND.icon.dataUri(color)} width={size} height={size} alt="" style={{ width: size, height: size, opacity }} />;
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
  const shade = (a: number) => `rgba(${C.photoShade},${a})`;
  return (
    <div style={{ width: W, height: H, display: "flex", flexDirection: "column", position: "relative", backgroundColor: C.text, fontFamily: FONT }}>
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
          backgroundImage: `linear-gradient(to top, ${shade(0.92)} 0%, ${shade(0.6)} 38%, ${shade(0.18)} 70%, ${shade(0.1)} 100%)`,
        }}
      />
      <Header color={C.onPhoto} s={s} />
      <div style={{ position: "absolute", left: 72 * s, width: W - 144 * s, bottom: 160 * s, display: "flex", flexDirection: "column" }}>
        {kicker && <div style={{ display: "flex", color: C.surfaceSoft, fontSize: 26 * s, fontWeight: 700, letterSpacing: 4 * s }}>{kicker}</div>}
        <div
          style={{
            display: "flex",
            marginTop: kicker ? 20 * s : 0,
            color: C.onPhoto,
            fontSize: headlineSize(slide.headline, isCover) * s,
            fontWeight: 700,
            lineHeight: 1.28,
            whiteSpace: "pre-wrap",
          }}
        >
          {slide.headline}
        </div>
        {slide.body && (
          <div style={{ display: "flex", marginTop: 30 * s, color: C.onPhoto, opacity: 0.9, fontSize: 33 * s, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{slide.body}</div>
        )}
      </div>
      <Footer color={C.onPhoto} s={s} ctx={ctx} index={index} total={post.slides.length} />
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
        backgroundColor: C.background,
        fontFamily: FONT,
        overflow: "hidden",
      }}
    >
      {/* ロゴアイコンの透かし（右下に大きく、はみ出させる） */}
      {!isCta && (
        <div style={{ position: "absolute", right: -300 * s, bottom: -260 * s, display: "flex" }}>
          <Icon color={C.accent} size={980 * s} opacity={BRAND.social.watermarkOpacity} />
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
          border: `${1.5 * s}px solid ${C.surfaceSoft}`,
          display: "flex",
        }}
      />
      <Header color={C.text} s={s} showIcon={!isCta} />
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
          <Icon color={C.text} size={220 * s} />
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginTop: 56 * s,
              color: C.text,
              fontSize: (headlineSize(slide.headline, false) - 6) * s,
              fontWeight: 700,
              lineHeight: 1.35,
              whiteSpace: "pre-wrap",
            }}
          >
            {slide.headline}
          </div>
          {slide.body && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: 28 * s, color: C.textMuted, fontSize: 30 * s, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
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
            <div style={{ display: "flex", color: C.accent, fontSize: 26 * s, fontWeight: 700, letterSpacing: 4 * s }}>{kicker}</div>
          ) : (
            <div style={{ display: "flex", width: 56 * s, height: 3 * s, backgroundColor: C.accent }} />
          )}
          <div
            style={{
              display: "flex",
              marginTop: 24 * s,
              color: C.text,
              fontSize: (headlineSize(slide.headline, isCover) - 4) * s,
              fontWeight: 700,
              lineHeight: 1.32,
              whiteSpace: "pre-wrap",
            }}
          >
            {slide.headline}
          </div>
          {slide.body && <div style={{ display: "flex", marginTop: 30 * s, color: C.textMuted, fontSize: 32 * s, lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{slide.body}</div>}
        </div>
      )}
      <Footer color={C.text} s={s} ctx={ctx} index={index} total={post.slides.length} />
    </div>
  );
}
