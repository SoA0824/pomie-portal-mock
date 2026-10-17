/**
 * SNS 投稿のブランド設定（色・フォント・ロゴ・ハッシュタグ）。
 *
 * 他社向けに展開するときは、ここを差し替えるだけでスライドの見た目と必須ハッシュタグが変わる:
 *   - data/brand.json … 名前・色・フォント・ハッシュタグ（スクリプト scripts/social/* も同じファイルを読む）
 *   - src/lib/social/brandAssets.ts … ロゴの SVG（色は __COLOR__ を置き換える）
 * テンプレート（templates.tsx）はこの BRAND 以外の固有値を持たない。
 */
import brandJson from "../../../data/brand.json";
import { POMIE_ICON_SVG, POMIE_WORDMARK_SVG, svgDataUri } from "./brandAssets";

export type SocialBrand = {
  name: string;
  colors: {
    /** クリーム地の背景 */
    background: string;
    /** 枠線など、背景になじむ淡い色 */
    surfaceSoft: string;
    /** 番号・アクセント線 */
    accent: string;
    /** 見出しの色 */
    text: string;
    /** 本文の色 */
    textMuted: string;
    /** 写真の上に載せる文字の色 */
    onPhoto: string;
    /** 写真に重ねる影の色（"r,g,b"） */
    photoShade: string;
  };
  font: {
    /** satori に渡すフォント名 */
    family: string;
    /** Google Fonts の family パラメータ（例: Noto+Sans+JP） */
    googleFamily: string;
  };
  social: {
    /** いつも付けるブランドのタグ（エリア名を後ろに付けた形も付く） */
    brandTags: string[];
    /** いつも付ける固定のタグ */
    fixedTags: string[];
    /** クリーム地の透かしの濃さ（0〜1） */
    watermarkOpacity: number;
  };
  /** ワードマーク（横長ロゴ） */
  wordmark: { dataUri: (color: string) => string; aspect: number };
  /** アイコン（正方形） */
  icon: { dataUri: (color: string) => string };
};

export const BRAND: SocialBrand = {
  name: brandJson.name,
  colors: brandJson.colors,
  font: brandJson.font,
  social: brandJson.social,
  wordmark: { dataUri: (color) => svgDataUri(POMIE_WORDMARK_SVG, color), aspect: 146 / 28 },
  icon: { dataUri: (color) => svgDataUri(POMIE_ICON_SVG, color) },
};
